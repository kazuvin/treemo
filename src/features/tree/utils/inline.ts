/**
 * ノードの中身のインライン Markdown（F-TREE-8）。強調・コード・リンク・取り消し線だけを読み、
 * HTML は作らずに木として返す（描くのは React の要素）。
 */

export type Inline =
  | { kind: 'text'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'strong' | 'em' | 'strike'; children: Inline[] }
  | { kind: 'link'; href: string; children: Inline[] }

interface Pattern {
  kind: 'code' | 'link' | 'strong' | 'strike' | 'em'
  re: RegExp
}

const PATTERNS: Pattern[] = [
  { kind: 'code', re: /`([^`]+)`/ },
  { kind: 'link', re: /\[([^\]]+)\]\(([^)\s]+)\)/ },
  { kind: 'strong', re: /\*\*(?=\S)(.+?)\*\*|__(?=\S)(.+?)__/ },
  { kind: 'strike', re: /~~(?=\S)(.+?)~~/ },
  { kind: 'em', re: /\*(?=\S)([^*]+?)\*|(?<![\p{L}\p{N}])_(?=\S)([^_]+?)_(?![\p{L}\p{N}])/u },
]

const ESCAPED = /\\([\\`*_~[\]()#+\-.!])/g
/** `\*` のようなエスケープを、記号として読まれない私用領域の文字に一時的に置き換える */
const PROTECT_BASE = 0xe000
const PROTECTED = /[\ue000-\ue07f]/g

function protect(source: string): string {
  return source.replaceAll(ESCAPED, (_, ch: string) =>
    String.fromCharCode(PROTECT_BASE + ch.charCodeAt(0)),
  )
}

function restore(value: string): string {
  return value.replaceAll(PROTECTED, (ch) => String.fromCharCode(ch.charCodeAt(0) - PROTECT_BASE))
}

function text(value: string): Inline[] {
  return value ? [{ kind: 'text', text: restore(value) }] : []
}

export function parseInline(source: string): Inline[] {
  return parseProtected(protect(source))
}

function parseProtected(source: string): Inline[] {
  const out: Inline[] = []
  let rest = source
  while (rest) {
    let best: { pattern: Pattern; match: RegExpExecArray } | null = null
    for (const pattern of PATTERNS) {
      const match = pattern.re.exec(rest)
      if (match && (!best || match.index < best.match.index)) {
        best = { pattern, match }
      }
    }
    if (!best) {
      out.push(...text(rest))
      break
    }
    const { pattern, match } = best
    out.push(...text(rest.slice(0, match.index)))
    const inner = match[1] ?? match[2] ?? ''
    switch (pattern.kind) {
      case 'code':
        out.push({ kind: 'code', text: restore(inner) })
        break
      case 'link':
        out.push({
          kind: 'link',
          href: restore(match[2] ?? ''),
          children: parseProtected(match[1] ?? ''),
        })
        break
      case 'strong':
      case 'strike':
      case 'em':
        out.push({ kind: pattern.kind, children: parseProtected(inner) })
        break
      default:
        break
    }
    rest = rest.slice(match.index + match[0].length)
  }
  return out
}

/** 中身を 1 行の平文にする（ヒントやアクセシビリティの名前に使う） */
export function plainText(source: string): string {
  const flatten = (nodes: Inline[]): string =>
    nodes.map((node) => ('children' in node ? flatten(node.children) : node.text)).join('')
  return source
    .split('\n')
    .map((line) => flatten(parseInline(line)))
    .join(' ')
}
