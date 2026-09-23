import type { KeyScope } from '@/lib/command'

export const SCOPE_LABELS: Record<KeyScope, string> = {
  global: 'どこでも',
  normal: 'NORMAL（エディタとサイドバー）',
  editor: 'エディタ',
  sidebar: 'サイドバー',
  block: 'ツリーブロックの上',
  tree: 'TREE モード',
}
