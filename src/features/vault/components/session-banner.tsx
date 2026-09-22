import { Button } from '@/components/ui/button'
import { useVaultStore } from '../stores/vault-store'

interface SessionBannerProps {
  onKeepMine: () => void
  onTakeTheirs: () => void
}

/**
 * 衝突と保存の失敗を、エディタの上にその場で出す。利用者が選ぶ必要があるので
 * トーストにはしない（docs/coding-standards.md の「失敗の伝え方」）。
 */
export function SessionBanner({ onKeepMine, onTakeTheirs }: SessionBannerProps) {
  const session = useVaultStore((s) => s.session)
  if (session.saveState === 'conflict') {
    return (
      <div
        role="alert"
        className="flex flex-wrap items-center gap-gap border-b border-border px-6 py-2"
      >
        <p className="mr-auto">
          このメモは外部で変更されました。こちらにも保存していない変更があります。
        </p>
        <Button
          variant="secondary"
          onClick={onKeepMine}
          title="コマンドパレット: 衝突: 手元の版を残す"
        >
          手元の版を残す
        </Button>
        <Button
          variant="secondary"
          onClick={onTakeTheirs}
          title="コマンドパレット: 衝突: 外の版を読み込む"
        >
          外の版を読み込む
        </Button>
      </div>
    )
  }
  if (session.saveState === 'error') {
    return (
      <div role="alert" className="border-b border-border px-6 py-2">
        保存できませんでした: {session.error}。入力を続けるか :w で、もう一度書き込みます。
      </div>
    )
  }
  return null
}
