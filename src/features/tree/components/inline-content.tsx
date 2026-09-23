import { Code } from '@/components/ui/code'
import { type Inline, parseInline, splitMatches } from '../utils/inline'

/** 検索に当たった部分を光らせる。記法の境目をまたぐ当たりは光らせない */
function Highlighted({ text, search }: { text: string; search: RegExp | null }) {
  return splitMatches(text, search).map((piece, i) =>
    piece.match ? (
      // oxlint-disable-next-line react/no-array-index-key -- 並びは文字列から決まり、入れ替わらない
      <mark key={i} className="bg-search-match text-inherit">
        {piece.text}
      </mark>
    ) : (
      piece.text
    ),
  )
}

function InlineNodes({ nodes, search }: { nodes: Inline[]; search: RegExp | null }) {
  return nodes.map((node, i) => {
    // 同じ行の中の並びは中身から決まり、並べ替えも挿入も起きない
    // oxlint-disable-next-line react/no-array-index-key -- 上のとおり
    const key = `${node.kind}-${i}`
    switch (node.kind) {
      case 'text':
        return (
          <span key={key}>
            <Highlighted text={node.text} search={search} />
          </span>
        )
      case 'code':
        return (
          <Code key={key}>
            <Highlighted text={node.text} search={search} />
          </Code>
        )
      case 'strong':
        return (
          <strong key={key} className="font-bold">
            <InlineNodes nodes={node.children} search={search} />
          </strong>
        )
      case 'em':
        return (
          <em key={key}>
            <InlineNodes nodes={node.children} search={search} />
          </em>
        )
      case 'strike':
        return (
          <s key={key} className="text-muted-foreground">
            <InlineNodes nodes={node.children} search={search} />
          </s>
        )
      case 'link':
        return (
          <span
            key={key}
            className="underline decoration-border-strong underline-offset-3"
            title={node.href}
          >
            <InlineNodes nodes={node.children} search={search} />
          </span>
        )
      default:
        return null
    }
  })
}

/** ノードの中身。行ごとにインライン Markdown を装飾して描く（F-TREE-8） */
export function InlineContent({
  content,
  search = null,
}: {
  content: string
  /** 光らせる検索（docs/tree-block.md の「検索」） */
  search?: RegExp | null
}) {
  const lines = content.split('\n')
  return lines.map((line, i) => (
    // oxlint-disable-next-line react/no-array-index-key -- 行の位置そのものが識別子
    <div key={i} className="min-h-5">
      <InlineNodes nodes={parseInline(line)} search={search} />
    </div>
  ))
}
