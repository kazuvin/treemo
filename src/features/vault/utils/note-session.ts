/**
 * 開いているメモ 1 つの、読み書きと衝突の状態。本文の正本はエディタにあり、
 * ここは「最後に揃えたときのハッシュ」と保存の時機だけを持つ。
 * 手順は docs/vault.md の「書き込み」「ファイルの監視」。
 */

export interface NoteIo {
  read: (rel: string) => Promise<{ content: string; hash: string }>
  write: (rel: string, content: string, baseHash: string | null) => Promise<string>
}

export interface DocHost {
  getText: () => string
  /** 外の版で置き換える。カーソルはできるだけ保ち、自動保存を起こさない */
  replaceText: (text: string) => void
}

export type SaveState = 'saved' | 'dirty' | 'saving' | 'error' | 'conflict'

export interface SessionSnapshot {
  saveState: SaveState
  /** 衝突しているとき、外の版 */
  theirs: { content: string; hash: string } | null
  error: string | null
}

/** 入力が止まってから書くまで */
export const AUTOSAVE_DELAY_MS = 500

function isConflictError(error: unknown): error is { kind: 'conflict'; currentHash?: string } {
  return typeof error === 'object' && error !== null && 'kind' in error && error.kind === 'conflict'
}

export class NoteSession {
  readonly path: string
  private baseHash: string
  private changeSeq = 0
  private savedSeq = 0
  private timer: ReturnType<typeof setTimeout> | null = null
  private inFlight: Promise<void> | null = null
  private snapshot: SessionSnapshot = { saveState: 'saved', theirs: null, error: null }
  private readonly io: NoteIo
  private readonly host: DocHost
  private readonly onChange: (snapshot: SessionSnapshot) => void

  constructor(
    path: string,
    hash: string,
    io: NoteIo,
    host: DocHost,
    onChange: (snapshot: SessionSnapshot) => void,
  ) {
    this.path = path
    this.baseHash = hash
    this.io = io
    this.host = host
    this.onChange = onChange
  }

  get state(): SessionSnapshot {
    return this.snapshot
  }

  /** 最後にファイルと揃えたときのハッシュ */
  get hash(): string {
    return this.baseHash
  }

  get dirty(): boolean {
    return this.changeSeq !== this.savedSeq
  }

  /** エディタで本文が変わったとき */
  markChanged(): void {
    this.changeSeq++
    if (this.snapshot.saveState !== 'conflict') {
      this.update({ saveState: 'dirty', error: null })
    }
    this.schedule()
  }

  /** 今すぐ書く（`:w`、メモの切り替え、ウィンドウのフォーカスが外れたとき） */
  async flush(): Promise<void> {
    this.cancelTimer()
    if (this.inFlight) {
      await this.inFlight
    }
    if (!this.dirty || this.snapshot.saveState === 'conflict') {
      return
    }
    this.inFlight = this.save()
    try {
      await this.inFlight
    } finally {
      this.inFlight = null
    }
  }

  /** 外部で書き換えられたという知らせを受けたとき */
  async onExternalChange(): Promise<void> {
    if (this.inFlight) {
      await this.inFlight
    }
    await this.reconcile()
  }

  private async reconcile(): Promise<void> {
    let theirs: { content: string; hash: string }
    try {
      theirs = await this.io.read(this.path)
    } catch (error) {
      console.error('外部の変更を読めませんでした', error)
      return
    }
    if (theirs.hash === this.baseHash) {
      return
    }
    if (!this.dirty) {
      this.host.replaceText(theirs.content)
      this.baseHash = theirs.hash
      this.update({ saveState: 'saved', theirs: null, error: null })
      return
    }
    if (theirs.content === this.host.getText()) {
      this.baseHash = theirs.hash
      this.savedSeq = this.changeSeq
      this.update({ saveState: 'saved', theirs: null, error: null })
      return
    }
    this.cancelTimer()
    this.update({ saveState: 'conflict', theirs })
  }

  /** 衝突を「手元の版を残す」で解く */
  async keepMine(): Promise<void> {
    const theirs = this.snapshot.theirs
    if (!theirs) {
      return
    }
    this.baseHash = theirs.hash
    this.update({ saveState: 'dirty', theirs: null })
    this.changeSeq++
    await this.flush()
  }

  /** 衝突を「外の版を読み込む」で解く */
  takeTheirs(): void {
    const theirs = this.snapshot.theirs
    if (!theirs) {
      return
    }
    this.host.replaceText(theirs.content)
    this.baseHash = theirs.hash
    this.savedSeq = this.changeSeq
    this.update({ saveState: 'saved', theirs: null, error: null })
  }

  dispose(): void {
    this.cancelTimer()
  }

  private schedule(): void {
    this.cancelTimer()
    this.timer = setTimeout(() => {
      this.timer = null
      void this.flush()
    }, AUTOSAVE_DELAY_MS)
  }

  private cancelTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  private async save(): Promise<void> {
    const seq = this.changeSeq
    const text = this.host.getText()
    this.update({ saveState: 'saving' })
    try {
      this.baseHash = await this.io.write(this.path, text, this.baseHash)
      this.savedSeq = seq
      this.update({ saveState: this.dirty ? 'dirty' : 'saved', error: null })
      if (this.dirty) {
        this.schedule()
      }
    } catch (error) {
      if (isConflictError(error)) {
        await this.reconcile()
        return
      }
      console.error('メモを保存できませんでした', error)
      this.update({
        saveState: 'error',
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  private update(patch: Partial<SessionSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch }
    this.onChange(this.snapshot)
  }
}
