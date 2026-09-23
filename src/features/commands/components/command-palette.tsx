import { Command as Cmdk } from 'cmdk'
import { Kbd } from '@/components/ui/kbd'
import { OverlayPanel } from '@/components/ui/overlay-panel'
import { usePresence } from '@/components/ui/use-presence'
import type { Command, CommandContext } from '@/lib/command'
import { isAvailable, useCommandStore } from '../stores/command-store'

function keyLabels(command: Command): string[] {
  return (command.keys ?? []).map((key) => key.sequence)
}

interface CommandPaletteProps {
  getContext: () => CommandContext
  /** パレットを閉じたあと、元の場所にフォーカスを戻す */
  restoreFocus: () => void
}

/** コマンドパレット（F-UX-1）。すべてのコマンドを、割り当てたキーと一緒に出す */
export function CommandPalette({ getContext, restoreFocus }: CommandPaletteProps) {
  const open = useCommandStore((s) => s.overlay === 'palette')
  const commands = useCommandStore((s) => s.commands)
  const setOverlay = useCommandStore((s) => s.setOverlay)
  const { mounted, closing } = usePresence(open)
  if (!mounted) {
    return null
  }
  const ctx = getContext()
  const available = commands.filter((command) => isAvailable(command, ctx))
  const close = () => {
    setOverlay(null)
    restoreFocus()
  }
  return (
    <OverlayPanel label="コマンドパレット" onDismiss={close} closing={closing}>
      <Cmdk
        label="コマンドパレット"
        loop
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            close()
          }
        }}
      >
        <Cmdk.Input
          autoFocus
          placeholder="コマンドの名前"
          className="h-12 w-full border-b border-border bg-transparent px-5 outline-none placeholder:text-muted-foreground"
        />
        <Cmdk.List className="max-h-[min(60vh,420px)] overflow-y-auto p-2">
          <Cmdk.Empty className="px-3 py-2 text-muted-foreground">
            一致するコマンドはありません
          </Cmdk.Empty>
          {available.map((command) => (
            <Cmdk.Item
              key={command.id}
              value={`${command.title} ${command.id}`}
              onSelect={() => {
                close()
                command.run(getContext())
              }}
              className="flex h-9 cursor-default items-center justify-between gap-4 rounded-sm px-3 data-[selected=true]:bg-selected"
            >
              <span className="truncate">{command.title}</span>
              <span className="flex shrink-0 gap-1">
                {keyLabels(command).map((label) => (
                  <Kbd key={label}>{label}</Kbd>
                ))}
              </span>
            </Cmdk.Item>
          ))}
        </Cmdk.List>
      </Cmdk>
    </OverlayPanel>
  )
}
