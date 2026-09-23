export interface TreeNode {
  /** 開いている間だけ使う一時的な ID（ルートからの添字をつないだもの）。ファイルには書かない */
  id: string
  /** 改行を含みうる。続き行の字下げは取り除いた形で持つ */
  content: string
  children: TreeNode[]
  /** 折りたたんでいるか。アプリだけが使い、ファイルには書かない */
  collapsed?: boolean
  /** 読んだときの、ブロックの中の 1 行目の行番号（0 が開始フェンス）。操作で足したノードには無い */
  line?: number
}

export interface StrayLine {
  /** ブロックの中の行番号（0 が開始フェンス） */
  line: number
  text: string
}

export interface TreeBlock {
  /** 開始フェンスの記号と数（例: "```"） */
  fence: string
  /** info 文字列の tree より後ろ。読めなくても保持する */
  info: string
  /** 終了フェンスの行。元のまま書き戻す */
  closing: string
  roots: TreeNode[]
  /** 読めない行。1 つでもあれば TREE モードに入れない */
  strayLines: StrayLine[]
}

/** ルートからの添字の並び。[] はどのノードも指さない */
export type NodePath = readonly number[]
