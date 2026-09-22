import { AUTOSAVE_DELAY_MS, NoteSession, type NoteIo, type SessionSnapshot } from './note-session'

function setup(initial = 'a') {
  let text = initial
  const files = new Map<string, { content: string; hash: string }>([
    ['n.md', { content: initial, hash: `h:${initial}` }],
  ])
  const io: NoteIo = {
    read: vi.fn((rel: string) => {
      const file = files.get(rel)
      return file ? Promise.resolve(file) : Promise.reject(new Error('missing'))
    }),
    write: vi.fn((rel: string, content: string, baseHash: string | null) => {
      const file = files.get(rel)
      if (file && baseHash !== file.hash) {
        return Promise.reject(Object.assign(new Error('conflict'), { kind: 'conflict' }))
      }
      files.set(rel, { content, hash: `h:${content}` })
      return Promise.resolve(`h:${content}`)
    }),
  }
  const snapshots: SessionSnapshot[] = []
  const host = {
    getText: () => text,
    replaceText: vi.fn((next: string) => {
      text = next
    }),
  }
  const session = new NoteSession('n.md', `h:${initial}`, io, host, (s) => snapshots.push(s))
  return {
    session,
    io,
    host,
    files,
    snapshots,
    type(next: string) {
      text = next
      session.markChanged()
    },
    external(content: string) {
      files.set('n.md', { content, hash: `h:${content}` })
    },
  }
}

describe('NoteSession', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('writes after typing stops', async () => {
    const t = setup()
    t.type('ab')
    t.type('abc')
    expect(t.session.state.saveState).toBe('dirty')
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS - 1)
    expect(t.io.write).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(t.io.write).toHaveBeenCalledOnce()
    expect(t.files.get('n.md')?.content).toBe('abc')
    expect(t.session.state.saveState).toBe('saved')
  })

  it('writes immediately on flush', async () => {
    const t = setup()
    t.type('x')
    await t.session.flush()
    expect(t.files.get('n.md')?.content).toBe('x')
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS)
    expect(t.io.write).toHaveBeenCalledOnce()
  })

  it('does not write when nothing changed', async () => {
    const t = setup()
    await t.session.flush()
    expect(t.io.write).not.toHaveBeenCalled()
  })

  it('reloads an external change when there are no local edits', async () => {
    const t = setup()
    t.external('theirs')
    await t.session.onExternalChange()
    expect(t.host.replaceText).toHaveBeenCalledWith('theirs')
    expect(t.session.state.saveState).toBe('saved')
  })

  it('ignores notifications for content it already has', async () => {
    const t = setup()
    t.type('mine')
    await t.session.flush()
    await t.session.onExternalChange()
    expect(t.host.replaceText).not.toHaveBeenCalled()
  })

  it('reports a conflict when there are local edits', async () => {
    const t = setup()
    t.type('mine')
    t.external('theirs')
    await t.session.onExternalChange()
    expect(t.session.state.saveState).toBe('conflict')
    expect(t.session.state.theirs?.content).toBe('theirs')
    expect(t.host.replaceText).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS * 2)
    expect(t.files.get('n.md')?.content).toBe('theirs')
  })

  it('turns a rejected write into a conflict instead of overwriting', async () => {
    const t = setup()
    t.external('theirs')
    t.type('mine')
    await t.session.flush()
    expect(t.session.state.saveState).toBe('conflict')
    expect(t.files.get('n.md')?.content).toBe('theirs')
  })

  it('keeps the local version when asked', async () => {
    const t = setup()
    t.type('mine')
    t.external('theirs')
    await t.session.onExternalChange()
    await t.session.keepMine()
    expect(t.files.get('n.md')?.content).toBe('mine')
    expect(t.session.state.saveState).toBe('saved')
  })

  it('loads the external version when asked', async () => {
    const t = setup()
    t.type('mine')
    t.external('theirs')
    await t.session.onExternalChange()
    t.session.takeTheirs()
    expect(t.host.replaceText).toHaveBeenCalledWith('theirs')
    expect(t.session.state.saveState).toBe('saved')
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS)
    expect(t.io.write).not.toHaveBeenCalled()
  })

  it('treats identical external content as already saved', async () => {
    const t = setup()
    t.type('same')
    t.external('same')
    await t.session.onExternalChange()
    expect(t.session.state.saveState).toBe('saved')
  })
})
