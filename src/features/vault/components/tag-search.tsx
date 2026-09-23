import { Command as Cmdk } from 'cmdk'
import { useState } from 'react'
import { OverlayPanel } from '@/components/ui/overlay-panel'
import { usePresence } from '@/components/ui/use-presence'
import { useVaultStore } from '../stores/vault-store'
import { fuzzyFilter } from '../utils/fuzzy'
import { findTag } from '../utils/tag-index'

const MAX_RESULTS = 100

const itemClass =
  'flex h-9 cursor-default items-center justify-between gap-4 rounded-sm px-3 data-[selected=true]:bg-selected'

interface TagSearchProps {
  onOpen: (path: string) => void
  onClose: () => void
}

function filter<T>(query: string, items: readonly T[], key: (item: T) => string): T[] {
  return (query ? fuzzyFilter(query, items, key) : items).slice(0, MAX_RESULTS)
}

/**
 * タグ検索（F-VAULT-8）。タグを選ぶと、そのタグを持つメモを並べる。
 * メモの一覧で何も打っていないときの Backspace でタグの一覧に戻る
 */
export function TagSearch({ onOpen, onClose }: TagSearchProps) {
  const search = useVaultStore((s) => s.tagSearch)
  const tags = useVaultStore((s) => s.tags)
  const setTagSearch = useVaultStore((s) => s.setTagSearch)
  const [query, setQuery] = useState('')
  const { mounted, closing } = usePresence(search !== null)
  if (!mounted) {
    return null
  }
  const selected = search?.tag ?? null
  const close = () => {
    setQuery('')
    onClose()
  }
  const choose = (tag: string | null) => {
    setQuery('')
    setTagSearch({ tag })
  }
  const entry = selected && tags ? findTag(tags, selected) : undefined
  let body
  if (!tags) {
    body = <p className="px-3 py-2 text-muted-foreground">タグを読み込んでいます…</p>
  } else if (selected === null) {
    const results = filter(query, tags, (t) => t.tag)
    body = (
      <>
        {results.map((t) => (
          <Cmdk.Item key={t.tag} value={t.tag} onSelect={() => choose(t.tag)} className={itemClass}>
            <span className="truncate">#{t.tag}</span>
            <span className="shrink-0 text-muted-foreground">{t.paths.length}</span>
          </Cmdk.Item>
        ))}
        {results.length === 0 && (
          <p className="px-3 py-2 text-muted-foreground">
            {tags.length === 0
              ? 'フロントマターに tags のあるメモがありません'
              : '一致するタグがありません'}
          </p>
        )}
      </>
    )
  } else {
    const results = filter(query, entry?.paths ?? [], (path) => path.replace(/\.md$/, ''))
    body = (
      <>
        {results.map((path) => (
          <Cmdk.Item
            key={path}
            value={path}
            onSelect={() => {
              close()
              onOpen(path)
            }}
            className={itemClass}
          >
            <span className="truncate">{path.replace(/\.md$/, '').normalize('NFC')}</span>
          </Cmdk.Item>
        ))}
        {results.length === 0 && (
          <p className="px-3 py-2 text-muted-foreground">
            {entry ? '一致するメモがありません' : `#${selected} のメモはありません`}
          </p>
        )}
      </>
    )
  }
  return (
    <OverlayPanel label="タグで探す" onDismiss={close} closing={closing}>
      <Cmdk
        label="タグで探す"
        shouldFilter={false}
        loop
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            close()
          } else if (event.key === 'Backspace' && query === '' && selected !== null) {
            event.preventDefault()
            choose(null)
          }
        }}
      >
        <div className="flex h-12 items-center gap-2 border-b border-border px-5">
          {selected !== null && (
            <span className="shrink-0 rounded-chip bg-muted px-2 text-subtle-foreground">
              #{entry?.tag ?? selected}
            </span>
          )}
          <Cmdk.Input
            autoFocus
            value={query}
            onValueChange={setQuery}
            placeholder={
              selected === null ? 'タグの名前' : 'メモの名前で絞り込む（空で ⌫ を押すとタグへ戻る）'
            }
            className="h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
          />
        </div>
        <Cmdk.List className="max-h-[min(60vh,420px)] overflow-y-auto p-2">{body}</Cmdk.List>
      </Cmdk>
    </OverlayPanel>
  )
}
