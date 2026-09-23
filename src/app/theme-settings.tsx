import { type KeyboardEvent, useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/cn'
import {
  type ColorToken,
  isHex,
  PALETTE_TOKENS,
  type PaletteToken,
  parseTokenValue,
  type ResolvedTheme,
  resolveTheme,
  resolveToken,
  THEMES,
  TOKEN_GROUPS,
  withAlpha,
  wouldResolve,
} from '@/lib/theme'
import { useThemeStore } from '@/stores/theme-store'

const GRID_COLUMNS = 6

const TOKENS: ColorToken[] = TOKEN_GROUPS.flatMap((g) => g.tokens)

function isPaletteToken(token: ColorToken): token is PaletteToken {
  return (PALETTE_TOKENS as readonly string[]).includes(token)
}

/** `<input type="color">` は 6 桁の色しか受けない */
function toPickerValue(color: string): string {
  if (color.length === 4) {
    return `#${color.slice(1).replaceAll(/./g, (c) => c + c)}`
  }
  return color.slice(0, 7)
}

type Editing =
  /** 意味のトークンの値を、パレットの段から選ぶ */
  | { token: ColorToken; mode: 'palette'; pick: number }
  /** 色を直に書く */
  | { token: ColorToken; mode: 'hex'; text: string }

function Swatch({ color, className }: { color: string; className?: string }) {
  return <span className={cn('rounded-full', className)} style={{ background: color }} />
}

function ThemeTile({
  theme,
  active,
  cursor,
  renaming,
  onRename,
  onRenameEnd,
  onClick,
}: {
  theme: ResolvedTheme
  active: boolean
  cursor: boolean
  renaming: string | null
  onRename: (text: string) => void
  onRenameEnd: (commit: boolean) => void
  onClick: () => void
}) {
  const color = (token: ColorToken) => resolveToken(theme.tokens, token) ?? 'transparent'
  return (
    // 名前を変える入力欄を中に置くので button にはしない。キーは外側の div が受ける
    // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- 上のとおり
    <div
      data-cursor={cursor}
      onClick={onClick}
      className={cn(
        'flex min-w-0 cursor-default flex-col gap-1 rounded-md border p-1',
        active ? 'border-selected-border' : 'border-border',
        cursor && 'bg-selected',
      )}
    >
      <span
        className="relative flex h-12 flex-col justify-between overflow-hidden rounded-sm border px-2 py-1.5"
        style={{ background: color('background'), borderColor: color('border') }}
      >
        {theme.backdrop && (
          // 画面と同じく、ぼかした写真に background の色を重ねる。小さいのでぼかしも小さくする
          <>
            <span
              className="absolute -inset-2 bg-cover bg-center blur-[3px]"
              style={{ backgroundImage: `url("${theme.backdrop.image}")` }}
            />
            <span
              className="absolute inset-0"
              style={{ background: withAlpha(color('background'), theme.backdrop.veil) }}
            />
          </>
        )}
        <span className="relative text-xs font-semibold" style={{ color: color('foreground') }}>
          Aa
        </span>
        <span className="relative flex gap-1">
          <Swatch color={color('primary')} className="size-2.5" />
          <Swatch color={color('muted-foreground')} className="size-2.5" />
          <Swatch color={color('ring')} className="size-2.5" />
        </span>
      </span>
      {renaming === null ? (
        <span className="truncate px-1 text-xs">
          {theme.label}
          {theme.custom && <span className="text-muted-foreground"> · {theme.base.label}</span>}
        </span>
      ) : (
        <input
          autoFocus
          value={renaming}
          aria-label="プリセットの名前"
          onChange={(event) => onRename(event.target.value)}
          onFocus={(event) => event.target.select()}
          onBlur={() => onRenameEnd(false)}
          onKeyDown={(event) => {
            event.stopPropagation()
            if (event.key === 'Enter') {
              event.preventDefault()
              onRenameEnd(true)
            } else if (event.key === 'Escape') {
              event.preventDefault()
              onRenameEnd(false)
            }
          }}
          className="h-5 min-w-0 rounded-sm border border-input bg-background px-1 text-xs outline-none focus-visible:border-selected-border"
        />
      )}
    </div>
  )
}

/**
 * 設定画面の「テーマ」。上でプリセットを選び、下で色のトークンを 1 つずつ変える。
 * 組み込みのプリセットで色を変えると、写したカスタムができてそちらを変える。
 */
export function ThemeSettings() {
  const themeId = useThemeStore((s) => s.theme)
  const customThemes = useThemeStore((s) => s.customThemes)
  const setTheme = useThemeStore((s) => s.setTheme)
  const setToken = useThemeStore((s) => s.setToken)
  const duplicateTheme = useThemeStore((s) => s.duplicateTheme)
  const renameCustom = useThemeStore((s) => s.renameCustom)
  const deleteCustom = useThemeStore((s) => s.deleteCustom)
  const [cursor, setCursor] = useState(() => {
    const index = [...THEMES.map((t) => t.id), ...customThemes.map((c) => c.id)].indexOf(themeId)
    return Math.max(index, 0)
  })
  const [editing, setEditing] = useState<Editing | null>(null)
  const [renaming, setRenaming] = useState<{ id: string; text: string } | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const theme = resolveTheme(themeId, customThemes)
  const presets = [
    ...THEMES.map((t) => resolveTheme(t.id, customThemes)),
    ...customThemes.map((c) => resolveTheme(c.id, customThemes)),
  ]
  /** グリッドの升の数。最後の 1 つは「カスタムを作る」 */
  const gridSize = presets.length + 1
  const at = Math.min(cursor, gridSize + TOKENS.length - 1)
  const inGrid = at < gridSize
  const preset = inGrid ? presets[at] : undefined
  const token = inGrid ? undefined : TOKENS[at - gridSize]
  const changed = theme.custom?.tokens ?? {}
  const deletingLabel = customThemes.find((c) => c.id === deleting)?.label

  useEffect(() => {
    rootRef.current?.focus()
  }, [])

  useEffect(() => {
    listRef.current?.querySelector('[data-cursor="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [at, editing])

  const focusRoot = () => rootRef.current?.focus()

  const choose = (index: number) => {
    const target = presets[index]
    if (target) {
      setTheme(target.id)
    } else {
      duplicateTheme()
      setCursor(presets.length)
    }
  }

  const startEditing = (name: ColorToken) => {
    setError(null)
    if (isPaletteToken(name)) {
      setEditing({ token: name, mode: 'hex', text: theme.tokens[name] })
    } else {
      const pick = PALETTE_TOKENS.indexOf(theme.tokens[name] as PaletteToken)
      setEditing({ token: name, mode: 'palette', pick: Math.max(pick, 0) })
    }
  }

  const apply = (name: ColorToken, value: string) => {
    if (!wouldResolve(theme.tokens, name, value)) {
      setError('トークンが互いを指し合って、色が決まらなくなる')
      return false
    }
    if (!theme.custom && value !== theme.tokens[name]) {
      // カスタムの升が 1 つ増えるので、同じトークンを指したままにする
      setCursor(at + 1)
    }
    setToken(name, value)
    return true
  }

  const stopEditing = () => {
    setEditing(null)
    setError(null)
    focusRoot()
  }

  const commitHex = (name: ColorToken, text: string) => {
    const value = parseTokenValue(text)
    if (value === null) {
      setError('#rrggbb の色か、トークンの名前（gray-900 など）を書く')
      return
    }
    if (apply(name, value)) {
      stopEditing()
    }
  }

  const endRename = (commit: boolean) => {
    if (commit && renaming && renaming.text.trim()) {
      renameCustom(renaming.id, renaming.text.trim())
    }
    setRenaming(null)
    focusRoot()
  }

  const onPaletteKey = (
    event: KeyboardEvent<HTMLDivElement>,
    edit: Editing & { mode: 'palette' },
  ) => {
    switch (event.key) {
      case 'h':
      case 'ArrowLeft':
        setEditing({ ...edit, pick: Math.max(edit.pick - 1, 0) })
        break
      case 'l':
      case 'ArrowRight':
        setEditing({ ...edit, pick: Math.min(edit.pick + 1, PALETTE_TOKENS.length - 1) })
        break
      case 'Enter':
      case ' ': {
        const value = PALETTE_TOKENS[edit.pick]
        if (value && apply(edit.token, value)) {
          stopEditing()
        }
        break
      }
      case '#':
      case 'i':
        setEditing({
          token: edit.token,
          mode: 'hex',
          text: resolveToken(theme.tokens, edit.token) ?? '',
        })
        break
      case 'Escape':
        stopEditing()
        break
      default:
        return
    }
    event.preventDefault()
    event.stopPropagation()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== rootRef.current) {
      return
    }
    if (editing?.mode === 'palette') {
      onPaletteKey(event, editing)
      return
    }
    if (deleting !== null) {
      if (event.key === 'y') {
        deleteCustom(deleting)
        setCursor(Math.min(at, gridSize - 2))
      }
      // 確かめている間は、ほかのキーでもやめる
      setDeleting(null)
      event.preventDefault()
      event.stopPropagation()
      return
    }
    const last = gridSize + TOKENS.length - 1
    switch (event.key) {
      case 'h':
      case 'ArrowLeft':
        if (!inGrid) {
          return
        }
        setCursor(Math.max(at - 1, 0))
        break
      case 'l':
      case 'ArrowRight':
        if (!inGrid) {
          return
        }
        setCursor(Math.min(at + 1, gridSize - 1))
        break
      case 'j':
      case 'ArrowDown':
        if (inGrid && at + GRID_COLUMNS < gridSize) {
          setCursor(at + GRID_COLUMNS)
        } else {
          setCursor(inGrid ? gridSize : Math.min(at + 1, last))
        }
        break
      case 'k':
      case 'ArrowUp':
        if (inGrid) {
          setCursor(Math.max(at - GRID_COLUMNS, 0))
        } else {
          setCursor(at === gridSize ? gridSize - 1 : at - 1)
        }
        break
      case 'g':
        setCursor(0)
        break
      case 'G':
        setCursor(last)
        break
      case 'Enter':
      case ' ':
      case 'c':
        if (inGrid) {
          choose(at)
        } else if (token) {
          startEditing(token)
        }
        break
      case 'e':
        if (preset?.custom) {
          setRenaming({ id: preset.id, text: preset.label })
        }
        break
      case 'd':
      case 'x':
        if (preset?.custom) {
          setDeleting(preset.id)
        }
        break
      case 'r':
        if (token) {
          setToken(token, null)
        }
        break
      default:
        return
    }
    event.preventDefault()
    event.stopPropagation()
  }

  const hint = (() => {
    if (error) {
      return error
    }
    if (deletingLabel !== undefined) {
      return `「${deletingLabel}」を消す？ y 消す · ほかのキーでやめる`
    }
    if (renaming) {
      return 'Enter 決める · Esc やめる'
    }
    if (editing?.mode === 'palette') {
      return 'h l パレットの段を選ぶ · Enter 決める · # 色を直に書く · Esc やめる'
    }
    if (editing?.mode === 'hex') {
      return '#rrggbb か、ほかのトークンの名前（gray-900 など） · Enter 決める · Esc やめる'
    }
    if (inGrid) {
      return `h j k l 移動 · Enter 選ぶ${preset?.custom ? ' · e 名前を変える · d 消す' : ''}`
    }
    return `j k 移動 · Enter 値を選ぶ · r ${theme.base.label} の値に戻す${
      theme.custom ? '' : ' · 変えると、写したカスタムができる'
    }`
  })()

  return (
    // プリセットのグリッドとトークンの一覧を、1 つのカーソルで動く
    // oxlint-disable-next-line jsx-a11y/no-static-element-interactions -- 上のとおり
    <div
      ref={rootRef}
      tabIndex={-1}
      className="flex min-h-0 flex-1 flex-col outline-none"
      onKeyDown={onKeyDown}
    >
      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto p-2">
        <h3 className="px-3 pt-1 pb-2 text-2xs font-semibold text-muted-foreground">プリセット</h3>
        <div className="grid grid-cols-6 gap-2 px-1">
          {presets.map((p, i) => (
            <ThemeTile
              key={p.id}
              theme={p}
              active={p.id === theme.id}
              cursor={at === i}
              renaming={renaming?.id === p.id ? renaming.text : null}
              onRename={(text) => setRenaming({ id: p.id, text })}
              onRenameEnd={endRename}
              onClick={() => {
                setCursor(i)
                setTheme(p.id)
                focusRoot()
              }}
            />
          ))}
          <button
            type="button"
            tabIndex={-1}
            data-cursor={at === presets.length}
            onClick={() => {
              choose(presets.length)
              focusRoot()
            }}
            className={cn(
              'flex min-h-[76px] flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border-strong text-xs text-muted-foreground',
              at === presets.length && 'bg-selected',
            )}
          >
            <span className="text-base">+</span>
            <span>今のテーマを写す</span>
          </button>
        </div>
        {TOKEN_GROUPS.map((group) => (
          <section key={group.label}>
            <h3 className="px-3 pt-4 pb-1 text-2xs font-semibold text-muted-foreground">
              {group.label}
            </h3>
            {group.tokens.map((name) => {
              const index = gridSize + TOKENS.indexOf(name)
              const value = theme.tokens[name]
              const color = resolveToken(theme.tokens, name) ?? '#000000'
              const edit = editing?.token === name ? editing : null
              return (
                <div key={name}>
                  {/* oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- キーは外側の div が受ける */}
                  <div
                    data-cursor={at === index}
                    className={cn(
                      'flex min-h-9 items-center gap-3 rounded-sm px-3',
                      at === index && 'bg-selected',
                    )}
                    onClick={() => {
                      setCursor(index)
                      if (edit?.mode !== 'hex') {
                        focusRoot()
                      }
                    }}
                    onDoubleClick={() => startEditing(name)}
                  >
                    <label
                      className="relative size-5 shrink-0 cursor-pointer rounded-sm border border-border-strong"
                      style={{ background: color }}
                    >
                      <input
                        type="color"
                        tabIndex={-1}
                        aria-label={`--color-${name} の色`}
                        value={toPickerValue(color)}
                        onChange={(event) => apply(name, event.target.value)}
                        className="absolute inset-0 size-full cursor-pointer opacity-0"
                      />
                    </label>
                    <span className="min-w-0 flex-1 truncate font-mono text-sm">
                      --color-{name}
                    </span>
                    {edit?.mode === 'hex' ? (
                      <input
                        autoFocus
                        value={edit.text}
                        aria-label={`--color-${name} の値`}
                        onChange={(event) => {
                          setEditing({ ...edit, text: event.target.value })
                          setError(null)
                        }}
                        onFocus={(event) => event.target.select()}
                        onBlur={stopEditing}
                        onKeyDown={(event) => {
                          event.stopPropagation()
                          if (event.key === 'Enter') {
                            event.preventDefault()
                            commitHex(name, edit.text)
                          } else if (event.key === 'Escape') {
                            event.preventDefault()
                            stopEditing()
                          }
                        }}
                        className="h-7 w-40 rounded-sm border border-input bg-background px-2 text-sm outline-none focus-visible:border-selected-border"
                      />
                    ) : (
                      <span
                        className={cn(
                          'w-40 truncate text-right text-sm',
                          isHex(value) ? 'text-foreground' : 'text-muted-foreground',
                        )}
                      >
                        {isHex(value) ? value : `→ ${value}`}
                      </span>
                    )}
                    <span className="w-8 shrink-0 text-right text-2xs text-muted-foreground">
                      {name in changed ? '変更' : ''}
                    </span>
                  </div>
                  {edit?.mode === 'palette' && (
                    <div className="flex flex-wrap gap-1 py-2 pr-3 pl-11">
                      {PALETTE_TOKENS.map((option, i) => (
                        <button
                          key={option}
                          type="button"
                          tabIndex={-1}
                          title={option}
                          aria-label={option}
                          aria-pressed={value === option}
                          onClick={() => {
                            if (apply(name, option)) {
                              stopEditing()
                            }
                          }}
                          className={cn(
                            'grid size-7 place-items-center rounded-sm border-2',
                            i === edit.pick ? 'border-selected-border' : 'border-transparent',
                          )}
                        >
                          <span
                            className={cn(
                              'size-5 rounded-sm border border-border-strong',
                              value === option && 'ring-2 ring-foreground ring-inset',
                            )}
                            style={{ background: resolveToken(theme.tokens, option) ?? '' }}
                          />
                        </button>
                      ))}
                      <span className="ml-2 self-center text-2xs text-muted-foreground">
                        {PALETTE_TOKENS[edit.pick]}
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
          </section>
        ))}
      </div>
      <p
        className={cn(
          'border-t border-border-hairline px-5 py-2 text-2xs',
          error || deleting ? 'text-foreground' : 'text-muted-foreground',
        )}
      >
        {hint}
      </p>
    </div>
  )
}
