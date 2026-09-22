import { type Inline, parseInline } from '../utils/inline'

function InlineNodes({ nodes }: { nodes: Inline[] }) {
  return nodes.map((node, i) => {
    // 同じ行の中の並びは中身から決まり、並べ替えも挿入も起きない
    // oxlint-disable-next-line react/no-array-index-key -- 上のとおり
    const key = `${node.kind}-${i}`
    switch (node.kind) {
      case 'text':
        return <span key={key}>{node.text}</span>
      case 'code':
        return (
          <code key={key} className="rounded-sm bg-muted px-0.5">
            {node.text}
          </code>
        )
      case 'strong':
        return (
          <strong key={key} className="font-bold">
            <InlineNodes nodes={node.children} />
          </strong>
        )
      case 'em':
        return (
          <em key={key}>
            <InlineNodes nodes={node.children} />
          </em>
        )
      case 'strike':
        return (
          <s key={key} className="text-muted-foreground">
            <InlineNodes nodes={node.children} />
          </s>
        )
      case 'link':
        return (
          <span
            key={key}
            className="underline decoration-border-strong underline-offset-3"
            title={node.href}
          >
            <InlineNodes nodes={node.children} />
          </span>
        )
      default:
        return null
    }
  })
}

/** ノードの中身。行ごとにインライン Markdown を装飾して描く（F-TREE-8） */
export function InlineContent({ content }: { content: string }) {
  const lines = content.split('\n')
  return lines.map((line, i) => (
    // oxlint-disable-next-line react/no-array-index-key -- 行の位置そのものが識別子
    <div key={i} className="min-h-5">
      <InlineNodes nodes={parseInline(line)} />
    </div>
  ))
}
