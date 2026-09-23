import { type KeyboardEvent, useEffect, useRef, useState } from 'react'
import { Kbd } from '@/components/ui/kbd'
import { cn } from '@/lib/cn'
import { type Command, KEY_SCOPES, type KeyBinding, type KeyScope } from '@/lib/command'
import { eventToken, formatSequence, isModifierOnly } from '@/lib/keys'
import { useCommandStore } from '../stores/command-store'
import type { KeyOverrides } from '../utils/key-overrides'
import { SCOPE_LABELS } from '../utils/scope-labels'

/** 最後のキーからこれだけ待って、続けて押すキーの記録を締める */
const RECORD_IDLE_MS = 1000

interface Row {
  command: Command
  /** コマンドの割り当ての何番目か。キーの無いコマンドは null の 1 行だけを持つ */
  index: number | null
  key: KeyBinding | null
}

interface Recording {
  command: Command
  /** 置き換える割り当ての番号。null なら足す */
  index: number | null
}

interface KeybindingEditorProps {
  /** 既定の割り当てのコマンド */
  commands: readonly Command[]
  overrides: KeyOverrides
  onChange: (overrides: KeyOverrides) => void
}

function scopeFor(
  tokens: readonly string[],
  command: Command,
  replacing: KeyBinding | null,
): KeyScope {
  if (tokens[0]?.startsWith('D-')) {
    return 'global'
  }
  const base: KeyScope = replacing?.scope ?? command.keys?.[0]?.scope ?? 'normal'
  // global には ⌘ の組み合わせだけを置く（docs/keybindings.md の「コマンドとキーの範囲」）
  return base === 'global' ? 'normal' : base
}

/**
 * 設定画面の「キー」。コマンドごとの割り当てを、キーを押して記録し直す。
 * 変えるたびに onChange を呼び、既定との差分が keybindings.json に書かれる。
 */
export function KeybindingEditor({ commands, overrides, onChange }: KeybindingEditorProps) {
  const setRecordingFlag = useCommandStore((s) => s.setRecording)
  const [cursor, setCursor] = useState(0)
  const [filter, setFilter] = useState('')
  const [filtering, setFiltering] = useState(false)
  const [recording, setRecording] = useState<Recording | null>(null)
  const [tokens, setTokens] = useState<string[]>([])
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const keysOf = (command: Command): KeyBinding[] => overrides[command.id] ?? command.keys ?? []
  const query = filter.trim().toLowerCase()
  const rows: Row[] = commands
    .filter(
      (command) =>
        !query ||
        command.title.toLowerCase().includes(query) ||
        command.id.toLowerCase().includes(query) ||
        keysOf(command).some((k) => k.sequence.toLowerCase().includes(query)),
    )
    .flatMap((command): Row[] => {
      const keys = keysOf(command)
      return keys.length === 0
        ? [{ command, index: null, key: null }]
        : keys.map((key, index) => ({ command, index, key }))
    })
  const at = Math.max(0, Math.min(cursor, rows.length - 1))
  const current = rows[at]

  useEffect(() => {
    rootRef.current?.focus()
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
      }
      setRecordingFlag(false)
    }
  }, [setRecordingFlag])

  useEffect(() => {
    listRef.current?.querySelector('[data-cursor="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [cursor, filter])

  const setKeys = (command: Command, keys: KeyBinding[]) => {
    onChange({ ...overrides, [command.id]: keys })
  }

  const startRecording = (target: Recording) => {
    setRecording(target)
    setTokens([])
    setRecordingFlag(true)
  }

  const stopRecording = () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setRecording(null)
    setTokens([])
    setRecordingFlag(false)
  }

  const commitRecording = (target: Recording, recorded: string[]) => {
    stopRecording()
    const keys = keysOf(target.command)
    const replacing = target.index === null ? null : (keys[target.index] ?? null)
    const binding = {
      scope: scopeFor(recorded, target.command, replacing),
      sequence: formatSequence(recorded),
    }
    if (target.index === null) {
      setKeys(target.command, [...keys, binding])
    } else {
      setKeys(
        target.command,
        keys.map((key, i) => (i === target.index ? binding : key)),
      )
    }
  }

  const onRecordKey = (event: KeyboardEvent<HTMLDivElement>, target: Recording) => {
    event.preventDefault()
    event.stopPropagation()
    if (isModifierOnly(event.nativeEvent)) {
      return
    }
    const token = eventToken(event.nativeEvent)
    if (token === 'Esc' && tokens.length === 0) {
      stopRecording()
      return
    }
    const next = [...tokens, token]
    setTokens(next)
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
    }
    timerRef.current = setTimeout(() => commitRecording(target, next), RECORD_IDLE_MS)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (recording) {
      onRecordKey(event, recording)
      return
    }
    if (event.target !== rootRef.current || !current) {
      return
    }
    const { command, index, key } = current
    const keys = keysOf(command)
    switch (event.key) {
      case 'j':
      case 'ArrowDown':
        setCursor(Math.min(at + 1, rows.length - 1))
        break
      case 'k':
      case 'ArrowUp':
        setCursor(Math.max(at - 1, 0))
        break
      case 'g':
        setCursor(0)
        break
      case 'G':
        setCursor(rows.length - 1)
        break
      case '/':
        setFiltering(true)
        requestAnimationFrame(() => inputRef.current?.focus())
        break
      case 'a':
        startRecording({ command, index: null })
        break
      case 'c':
      case 'Enter':
        startRecording({ command, index })
        break
      case 'd':
      case 'x':
        if (index !== null) {
          setKeys(
            command,
            keys.filter((_, i) => i !== index),
          )
        }
        break
      case 's':
        if (key && index !== null) {
          const scope = KEY_SCOPES[(KEY_SCOPES.indexOf(key.scope) + 1) % KEY_SCOPES.length]
          if (scope) {
            setKeys(
              command,
              keys.map((k, i) => (i === index ? { ...k, scope } : k)),
            )
          }
        }
        break
      case 'r': {
        const next = { ...overrides }
        Reflect.deleteProperty(next, command.id)
        onChange(next)
        break
      }
      default:
        return
    }
    event.preventDefault()
    event.stopPropagation()
  }

  const effective = commands.map((command) => ({ command, keys: keysOf(command) }))
  const conflictsOf = (row: Row): string[] =>
    row.key
      ? effective
          .filter(
            ({ command, keys }) =>
              command.id !== row.command.id &&
              keys.some((k) => k.scope === row.key?.scope && k.sequence === row.key.sequence),
          )
          .map(({ command }) => command.title)
      : []

  return (
    // 一覧を j / k で動き、a / c / d / s / r で割り当てを変える
    // oxlint-disable-next-line jsx-a11y/no-static-element-interactions -- 上のとおり
    <div
      ref={rootRef}
      tabIndex={-1}
      className="flex min-h-0 flex-1 flex-col outline-none"
      onKeyDown={onKeyDown}
    >
      <div className="flex h-10 items-center gap-gap border-b border-border-hairline px-5">
        <span className="text-muted-foreground">/</span>
        <input
          ref={inputRef}
          value={filter}
          readOnly={!filtering}
          tabIndex={filtering ? 0 : -1}
          placeholder="/ で絞り込む（名前・ID・キー）"
          aria-label="コマンドを絞り込む"
          className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
          onChange={(event) => {
            setFilter(event.target.value)
            setCursor(0)
          }}
          onKeyDown={(event) => {
            // 入力中の文字や Esc を、設定画面の閉じる操作に渡さない
            event.stopPropagation()
            if (event.key === 'Enter' || event.key === 'Escape') {
              event.preventDefault()
              if (event.key === 'Escape') {
                setFilter('')
              }
              setFiltering(false)
              rootRef.current?.focus()
            }
          }}
        />
      </div>
      <ul ref={listRef} className="min-h-0 flex-1 overflow-y-auto p-2">
        {rows.length === 0 && (
          <li className="px-3 py-2 text-muted-foreground">一致するコマンドはありません</li>
        )}
        {rows.map((row) => {
          const isCursor = row === current
          const isRecording =
            recording?.command.id === row.command.id && recording.index === row.index
          const conflicts = conflictsOf(row)
          const changed = overrides[row.command.id] !== undefined
          return (
            <li
              key={`${row.command.id}:${row.index ?? '-'}`}
              data-cursor={isCursor}
              className={cn(
                'grid min-h-9 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 rounded-sm px-3 py-1',
                isCursor && 'bg-selected',
              )}
            >
              <span className="flex min-w-0 items-baseline gap-2">
                <span
                  className={cn(
                    'truncate',
                    row.index !== null && row.index > 0 && 'text-muted-foreground',
                  )}
                >
                  {row.command.title}
                </span>
                <span className="shrink-0 text-2xs text-muted-foreground">{row.command.id}</span>
                {changed && (row.index === null || row.index === 0) && (
                  <span className="shrink-0 text-2xs text-subtle-foreground">変更済み</span>
                )}
              </span>
              <span className="flex items-center gap-2">
                {row.key && (
                  <span className="text-2xs text-muted-foreground">
                    {SCOPE_LABELS[row.key.scope]}
                  </span>
                )}
                {isRecording ? (
                  <Kbd className="border-selected-border">
                    {tokens.length > 0 ? formatSequence(tokens) : 'キーを押す…'}
                  </Kbd>
                ) : (
                  <Kbd className={cn(!row.key && 'text-muted-foreground')}>
                    {row.key?.sequence ?? 'なし'}
                  </Kbd>
                )}
              </span>
              {conflicts.length > 0 && (
                <span className="col-span-2 text-2xs text-subtle-foreground">
                  同じ範囲で重なっています · {conflicts.join('、')}
                </span>
              )}
            </li>
          )
        })}
      </ul>
      <p className="border-t border-border-hairline px-5 py-2 text-2xs text-muted-foreground">
        {recording
          ? 'キーを押す · 止めると 1 秒で決まる · 続けて押すキー（<Space>ff など）もそのまま押す · 最初に Esc でやめる'
          : 'j k 移動 · Enter / c 変える · a 足す · d 外す · s 範囲を変える · r 既定に戻す · / 絞り込む'}
      </p>
    </div>
  )
}
