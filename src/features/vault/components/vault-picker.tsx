import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { useVaultStore } from '../stores/vault-store'

/** 保管庫を選ぶ画面（F-VAULT-1） */
export function VaultPicker({ onPick }: { onPick: () => void }) {
  const openError = useVaultStore((s) => s.openError)
  return (
    <main className="grid h-dvh place-items-center px-edge-h text-base">
      <div className="flex w-[min(420px,100%)] flex-col gap-gap">
        <h1 className="font-bold">Treemo</h1>
        <p className="text-subtle-foreground">
          メモを置くフォルダ（保管庫）を選んでください。iCloud Drive の中のフォルダを選ぶと、 ほかの
          Mac とも同じメモを使えます。
        </p>
        {openError && (
          <p className="border-l-2 border-border-strong pl-3 text-subtle-foreground">
            前回の保管庫を開けませんでした: {openError}
          </p>
        )}
        <div className="h-block-tight" />
        <Button size="large" fullWidth autoFocus onClick={onPick}>
          保管庫を選ぶ <Kbd className="border-transparent bg-gray-800 text-gray-0">Enter</Kbd>
        </Button>
      </div>
    </main>
  )
}
