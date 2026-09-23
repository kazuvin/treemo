export interface CachedNote {
  content: string
  hash: string
}

/**
 * 開く前に読んでおいたメモと、閉じたメモの中身。開くときに IPC を待たずに描くために使う。
 * 古い中身で描いても、開いたあとに読み直して揃える（docs/vault.md の「先読み」）。
 */
export class NoteCache {
  private readonly entries = new Map<string, CachedNote>()
  /** 捨てた回数。読みに行っている間に捨てられたものを、あとから入れないため */
  private readonly versions = new Map<string, number>()
  /** clear の回数。保管庫を開き直す前に始めた読み込みを、まとめて捨てるため */
  private generation = 0
  private readonly limit: number

  constructor(limit = 50) {
    this.limit = limit
  }

  get(path: string): CachedNote | undefined {
    return this.entries.get(path)
  }

  has(path: string): boolean {
    return this.entries.has(path)
  }

  version(path: string): string {
    return `${this.generation}:${this.versions.get(path) ?? 0}`
  }

  /** version を渡したときは、そのあとに捨てられていなければ入れる */
  set(path: string, note: CachedNote, version?: string): void {
    if (version !== undefined && version !== this.version(path)) {
      return
    }
    this.entries.delete(path)
    this.entries.set(path, note)
    for (const old of this.entries.keys()) {
      if (this.entries.size <= this.limit) {
        break
      }
      this.entries.delete(old)
    }
  }

  delete(path: string): void {
    this.entries.delete(path)
    this.versions.set(path, (this.versions.get(path) ?? 0) + 1)
  }

  clear(): void {
    this.entries.clear()
    this.versions.clear()
    this.generation++
  }
}
