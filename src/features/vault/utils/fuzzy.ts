/**
 * ファイル名のあいまい検索。打った文字が順に現れれば一致とし、
 * 続けて一致するほど、名前の先頭や区切りの直後で一致するほど高く数える。
 */
export function fuzzyScore(query: string, target: string): number | null {
  const q = query.normalize('NFC').toLowerCase().replaceAll(' ', '')
  const t = target.normalize('NFC').toLowerCase()
  if (!q) {
    return 0
  }
  let score = 0
  let ti = 0
  let prev = -2
  for (const ch of q) {
    const found = t.indexOf(ch, ti)
    if (found === -1) {
      return null
    }
    score += 1
    if (found === prev + 1) {
      score += 3
    }
    const before = t[found - 1]
    if (found === 0 || before === '/' || before === ' ' || before === '-' || before === '_') {
      score += 2
    }
    prev = found
    ti = found + 1
  }
  // 短い名前ほど、打ったものに近い
  return score - t.length * 0.01
}

export function fuzzyFilter<T>(query: string, items: readonly T[], key: (item: T) => string): T[] {
  return items
    .map((item) => ({ item, score: fuzzyScore(query, key(item)) }))
    .filter((x): x is { item: T; score: number } => x.score !== null)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.item)
}
