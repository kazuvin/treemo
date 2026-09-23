import { z } from 'zod'

/**
 * 利用者が変えられる Vim の設定（docs/keybindings.md の「Vim の設定」）。
 * アプリの状態に保存し、起動時と設定を変えたときに applyVimConfig で Vim に流す。
 */
const vimMappingSchema = z.object({
  mode: z.enum(['normal', 'visual', 'insert']),
  /** 押すキー。Vim の表記（`<C-x>` など） */
  lhs: z.string().min(1),
  /** 置き換えるキー */
  rhs: z.string().min(1),
  /** true なら rhs の中の割り当てを展開しない（`noremap`） */
  noremap: z.boolean().default(true),
})

type VimMapping = z.infer<typeof vimMappingSchema>

/** Treemo が足す割り当て。設定の mappings を丸ごと置き換えれば外せる */
const DEFAULT_VIM_MAPPINGS: readonly VimMapping[] = [
  // Neovim の既定に合わせる。行ごとのコピーは yy で足りる
  { mode: 'normal', lhs: 'Y', rhs: 'y$', noremap: true },
]

export const vimConfigSchema = z.object({
  /**
   * 'unnamed' ならヤンクした中身を macOS のクリップボードにも書く。削除（x / dd）は
   * 書かない。消すたびにクリップボードが上書きされると、ほかのアプリから貼り付けにくい
   */
  clipboard: z.enum(['unnamed', 'none']).default('unnamed'),
  mappings: z.array(vimMappingSchema).default(() => [...DEFAULT_VIM_MAPPINGS]),
})

export type VimConfig = z.infer<typeof vimConfigSchema>

export const DEFAULT_VIM_CONFIG: VimConfig = vimConfigSchema.parse({})
