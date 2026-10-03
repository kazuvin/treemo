/** 日付を組み立てる入口（docs/coding-standards.md）。生の Date はここでだけ作る */

export function now(): Date {
  return new Date()
}

const pad = (n: number) => String(n).padStart(2, '0')

/** 端末の時刻での `YYYYMMDDHHmmss`。Obsidian が貼り付けた画像の名前に使う形 */
export function compactTimestamp(date: Date): string {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('')
}
