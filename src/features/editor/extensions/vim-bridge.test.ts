import { markdown } from '@codemirror/lang-markdown'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { getCM, Vim } from '@replit/codemirror-vim'
import { DEFAULT_VIM_CONFIG, type VimConfig, vimConfigSchema } from '../utils/vim-config'
import { applyVimConfig, feedVimKeys, vimBridge } from './vim-bridge'

let opened: EditorView | undefined

function setup(doc: string): EditorView {
  const created = new EditorView({
    parent: document.body,
    state: EditorState.create({ doc, extensions: [vimBridge(() => undefined), markdown()] }),
  })
  opened = created
  return created
}

function lineOfCursor(target: EditorView): number {
  return target.state.doc.lineAt(target.state.selection.main.head).number
}

function unnamed(): string {
  return Vim.getRegisterController().getRegister('"').toString()
}

afterEach(() => {
  applyVimConfig(DEFAULT_VIM_CONFIG)
  opened?.destroy()
  opened = undefined
})

describe('vimConfigSchema', () => {
  it('fills in the defaults', () => {
    expect(vimConfigSchema.parse({})).toEqual(DEFAULT_VIM_CONFIG)
    expect(DEFAULT_VIM_CONFIG.clipboard).toBe('unnamed')
  })
})

describe('heading motions', () => {
  it('jumps between headings with ]] and [[', () => {
    const view = setup('# a\ntext\n```\n# not a heading\n```\n## b\ntext')
    feedVimKeys(view, [']', ']'])
    expect(lineOfCursor(view)).toBe(6)
    feedVimKeys(view, ['[', '['])
    expect(lineOfCursor(view)).toBe(1)
  })
})

describe('applyVimConfig', () => {
  it('yanks to the end of the line with Y by default', () => {
    const view = setup('abc def')
    feedVimKeys(view, ['w', 'Y'])
    expect(unnamed()).toBe('def')
  })

  it('applies mappings from the config and drops removed ones', () => {
    const view = setup('abc def')
    const config: VimConfig = {
      clipboard: 'none',
      mappings: [{ mode: 'insert', lhs: 'jk', rhs: '<Esc>', noremap: true }],
    }
    applyVimConfig(config)
    feedVimKeys(view, ['i', 'j', 'k'])
    expect(getCM(view)?.state.vim?.insertMode).toBe(false)
    feedVimKeys(view, ['Y'])
    expect(unnamed()).toBe('abc def\n')
  })
})

describe('search highlight', () => {
  function highlighted(target: EditorView): boolean {
    return target.dom.querySelector('.cm-searchMatch') !== null
  }

  it('keeps the highlight while n moves between hits and clears it on any other key', () => {
    vi.useFakeTimers()
    try {
      const view = setup('beta\nalpha beta\nbeta\n')
      const cm = getCM(view)
      if (!cm) {
        throw new Error('vim is missing')
      }
      Vim.handleKey(cm, '*', 'user')
      vi.runAllTimers()
      expect(highlighted(view)).toBe(true)
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'n' }))
      expect(highlighted(view)).toBe(true)
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'j' }))
      expect(highlighted(view)).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })
})
