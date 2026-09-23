import { type KeyboardEvent, useEffect, useRef, useState } from 'react'
import { Kbd } from '@/components/ui/kbd'
import { OverlayPanel } from '@/components/ui/overlay-panel'
import { Select } from '@/components/ui/select'
import { KeybindingEditor } from '@/features/commands/components/keybinding-editor'
import { useDiagramStore } from '@/features/diagram/stores/diagram-store'
import { useVaultStore } from '@/features/vault/stores/vault-store'
import { BGM_CHOICES, BGM_VOLUMES, bgmChoiceLabel, DEFAULT_BGM_VOLUME } from '@/lib/ambience'
import { cn } from '@/lib/cn'
import { DEFAULT_FONT_SIZE, FONT_SIZES } from '@/lib/font-size'
import { currentKeyOverrides, defaultCommands, pickVault, saveKeyOverrides } from './commands'
import { openKeybindings } from './keybindings'
import { ThemeSettings } from './theme-settings'
import { useUiStore } from './ui-store'

type Tab = 'general' | 'theme' | 'keys'

const TABS: { id: Tab; label: string }[] = [
  { id: 'general', label: '一般' },
  { id: 'theme', label: 'テーマ' },
  { id: 'keys', label: 'キー' },
]

interface Item {
  label: string
  /** 選べる値。action の項目は持たない */
  options?: { label: string; selected: boolean; select: () => void }[]
  /** 値をボタンで並べずセレクタで選ぶ。Enter で開く */
  dropdown?: boolean
  /** Enter で走らせる操作と、その説明 */
  action?: { label: string; run: () => void }
}

function cycle(options: NonNullable<Item['options']>, delta: 1 | -1): void {
  const index = options.findIndex((o) => o.selected)
  options[(index + delta + options.length) % options.length]?.select()
}

function GeneralSettings({ onClose }: { onClose: () => void }) {
  const [cursor, setCursor] = useState(0)
  const [openSelect, setOpenSelect] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const sidebarSide = useUiStore((s) => s.sidebarSide)
  const setSidebarSide = useUiStore((s) => s.setSidebarSide)
  const fontSize = useUiStore((s) => s.fontSize)
  const setFontSize = useUiStore((s) => s.setFontSize)
  const bgm = useUiStore((s) => s.bgm)
  const setBgm = useUiStore((s) => s.setBgm)
  const bgmVolume = useUiStore((s) => s.bgmVolume)
  const setBgmVolume = useUiStore((s) => s.setBgmVolume)
  const showKeyGuide = useDiagramStore((s) => s.showKeyGuide)
  const setShowKeyGuide = useDiagramStore((s) => s.setShowKeyGuide)
  const vault = useVaultStore((s) => s.vault)

  useEffect(() => {
    rootRef.current?.focus()
  }, [])

  const items: Item[] = [
    {
      label: 'サイドバーの位置',
      options: (['left', 'right'] as const).map((side) => ({
        label: side === 'left' ? '左' : '右',
        selected: sidebarSide === side,
        select: () => setSidebarSide(side),
      })),
    },
    {
      label: '文字の大きさ',
      dropdown: true,
      options: FONT_SIZES.map((size) => ({
        label: size === DEFAULT_FONT_SIZE ? `${size}px（既定）` : `${size}px`,
        selected: fontSize === size,
        select: () => setFontSize(size),
      })),
    },
    {
      label: 'BGM',
      dropdown: true,
      options: BGM_CHOICES.map((choice) => ({
        label: bgmChoiceLabel(choice),
        selected: bgm === choice,
        select: () => setBgm(choice),
      })),
    },
    {
      label: 'BGM の音量',
      dropdown: true,
      options: BGM_VOLUMES.map((volume) => ({
        label: volume === DEFAULT_BGM_VOLUME ? `${volume}%（既定）` : `${volume}%`,
        selected: bgmVolume === volume,
        select: () => setBgmVolume(volume),
      })),
    },
    {
      label: 'DIAGRAM モードの次のキーの案内',
      options: [true, false].map((show) => ({
        label: show ? '出す' : '出さない',
        selected: showKeyGuide === show,
        select: () => setShowKeyGuide(show),
      })),
    },
    {
      label: '保管庫',
      action: {
        label: vault ? `${vault.name.normalize('NFC')} · 選び直す` : '選ぶ',
        run: () => {
          onClose()
          void pickVault()
        },
      },
    },
    {
      label: 'キーの割り当てのファイル',
      action: {
        label: 'keybindings.json をテキストエディタで開く',
        run: () => void openKeybindings(),
      },
    },
  ]

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const item = items[cursor]
    if (!item) {
      return
    }
    switch (event.key) {
      case 'j':
      case 'ArrowDown':
        setCursor(Math.min(cursor + 1, items.length - 1))
        break
      case 'k':
      case 'ArrowUp':
        setCursor(Math.max(cursor - 1, 0))
        break
      case 'h':
      case 'ArrowLeft':
        if (item.options) {
          cycle(item.options, -1)
        }
        break
      case 'l':
      case 'ArrowRight':
        if (item.options) {
          cycle(item.options, 1)
        }
        break
      case ' ':
        if (item.dropdown) {
          setOpenSelect(item.label)
        } else if (item.options) {
          cycle(item.options, 1)
        }
        break
      case 'Enter':
        if (item.dropdown) {
          setOpenSelect(item.label)
        } else if (item.options) {
          cycle(item.options, 1)
        } else {
          item.action?.run()
        }
        break
      default:
        return
    }
    event.preventDefault()
    event.stopPropagation()
  }

  return (
    // 項目を j / k で動き、h / l で値を変える
    // oxlint-disable-next-line jsx-a11y/no-static-element-interactions -- 上のとおり
    <div
      ref={rootRef}
      tabIndex={-1}
      className="flex min-h-0 flex-1 flex-col outline-none"
      onKeyDown={onKeyDown}
    >
      <ul className="min-h-0 flex-1 overflow-y-auto p-2">
        {items.map((item, i) => (
          <li
            key={item.label}
            className={cn(
              'flex min-h-10 items-center justify-between gap-4 rounded-sm px-3',
              i === cursor && 'bg-selected',
            )}
          >
            <span>{item.label}</span>
            {item.options && item.dropdown && (
              <Select
                label={item.label}
                options={item.options.map((option, index) => ({
                  value: index,
                  label: option.label,
                }))}
                value={item.options.findIndex((option) => option.selected)}
                onChange={(index) => item.options?.[index]?.select()}
                open={openSelect === item.label}
                onOpenChange={(open) => {
                  setCursor(i)
                  setOpenSelect(open ? item.label : null)
                  if (!open) {
                    rootRef.current?.focus()
                  }
                }}
              />
            )}
            {item.options && !item.dropdown && (
              <span className="flex items-center gap-1">
                {item.options.map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    tabIndex={-1}
                    onClick={option.select}
                    className={cn(
                      'h-7 rounded-sm border px-2 text-sm',
                      option.selected
                        ? 'border-border-strong bg-background font-semibold text-foreground'
                        : 'border-transparent text-muted-foreground',
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </span>
            )}
            {item.action && (
              <button
                type="button"
                tabIndex={-1}
                onClick={item.action.run}
                className="flex items-center gap-2 text-sm text-subtle-foreground"
              >
                {item.action.label} <Kbd>Enter</Kbd>
              </button>
            )}
          </li>
        ))}
      </ul>
      <p className="border-t border-border-hairline px-5 py-2 text-2xs text-muted-foreground">
        j k 移動 · h l 値を変える · Enter 決める / 一覧を開く
      </p>
    </div>
  )
}

/** 設定画面（⌘,）。一般の設定、テーマ、キーの割り当て */
export function SettingsScreen({ onClose, closing }: { onClose: () => void; closing?: boolean }) {
  const [tab, setTab] = useState<Tab>('general')
  const [overrides, setOverrides] = useState(currentKeyOverrides)

  return (
    <OverlayPanel
      label="設定"
      onDismiss={onClose}
      closing={closing}
      className="flex h-[min(640px,calc(100vh-144px))] w-[min(820px,calc(100vw-48px))] flex-col"
    >
      {/* 中の一覧が受けなかった Tab / Esc / q を受ける */}
      {/* oxlint-disable-next-line jsx-a11y/no-static-element-interactions -- 上のとおり */}
      <div
        className="flex min-h-0 flex-1 flex-col"
        onKeyDown={(event) => {
          if (event.key === 'Tab') {
            event.preventDefault()
            setTab((t) => {
              const index = TABS.findIndex((x) => x.id === t) + (event.shiftKey ? -1 : 1)
              return TABS[(index + TABS.length) % TABS.length]?.id ?? t
            })
          } else if (event.key === 'Escape' || event.key === 'q') {
            event.preventDefault()
            onClose()
          }
        }}
      >
        <header className="flex h-12 items-center gap-4 border-b border-border px-5">
          <span className="font-semibold">設定</span>
          <nav className="flex h-full items-stretch gap-4">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                tabIndex={-1}
                aria-pressed={tab === t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'border-b-2 px-1',
                  tab === t.id
                    ? 'border-selected-border font-semibold text-foreground'
                    : 'border-transparent text-muted-foreground',
                )}
              >
                {t.label}
              </button>
            ))}
          </nav>
          <span className="ml-auto text-2xs text-muted-foreground">Tab 切り替え · Esc 閉じる</span>
        </header>
        {tab === 'general' && <GeneralSettings onClose={onClose} />}
        {tab === 'theme' && <ThemeSettings />}
        {tab === 'keys' && (
          <KeybindingEditor
            commands={defaultCommands}
            overrides={overrides}
            onChange={(next) => {
              setOverrides(next)
              void saveKeyOverrides(next)
            }}
          />
        )}
      </div>
    </OverlayPanel>
  )
}
