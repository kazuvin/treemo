/*
 * このリポジトリ専用の Oxlint プラグイン（名前は `treemo`）。
 * 組み込みルールで表せない禁止事項をここに置く。有効化と除外ファイルの指定は
 * .oxlintrc.json 側で行う（rules と overrides）。
 *
 * ESLint 互換の API で書いている。JS プラグインは Oxlint では alpha なので、
 * AST のノード名は ESTree（typescript-estree）のものに従う。
 */

/** 例外を書きたい行には `// oxlint-disable-next-line treemo/<rule> -- 理由` を置く。 */
const noRawDate = {
  meta: {
    type: 'problem',
    docs: {
      description: '日付を組み立てる入口を src/lib/date.ts の 1 つに閉じる（生の Date を禁じる）',
    },
  },
  create(context) {
    /*
     * Date は `new Date('2026-03-09')` が UTC 0 時と解釈されるなど扱いを誤りやすく、
     * 各コンポーネントで直に触られると同じ間違いが何度でも入る。ノートの日付は
     * frontmatter の YYYY-MM-DD が出典で、表示に落とすのは date.ts の役目に限る。
     *
     * `no-restricted-globals` で Date を禁じると型注釈の `Date` まで落ちるので、
     * 生成式と静的メソッドだけを狙う。
     */
    return {
      NewExpression(node) {
        if (node.callee.type === 'Identifier' && node.callee.name === 'Date') {
          context.report({
            node,
            message: '生の new Date() は使わず @/lib/date のユーティリティを使ってください。',
          })
        }
      },
      CallExpression(node) {
        const callee = node.callee
        if (
          callee.type === 'MemberExpression' &&
          !callee.computed &&
          callee.object.type === 'Identifier' &&
          callee.object.name === 'Date' &&
          callee.property.type === 'Identifier' &&
          ['now', 'parse', 'UTC'].includes(callee.property.name)
        ) {
          context.report({
            node,
            message: 'Date の静的メソッドは使わず @/lib/date のユーティリティを使ってください。',
          })
        }
      },
    }
  },
}

/** 自前モジュール（相対パスと @/ エイリアス）を指す指定子か。 */
const isLocalSource = (value) =>
  typeof value === 'string' &&
  (value.startsWith('./') || value.startsWith('../') || value.startsWith('@/'))

const noNamespaceImport = {
  meta: {
    type: 'suggestion',
    docs: { description: '自前モジュールを `import * as` / 動的 import() で読み込まない' },
  },
  create(context) {
    const message =
      "自前モジュールを `import * as` で読み込むことはできません。`import { Foo } from '...'` の形で参照してください。外部ライブラリは対象外です。"
    return {
      ImportDeclaration(node) {
        if (
          isLocalSource(node.source.value) &&
          node.specifiers.some((specifier) => specifier.type === 'ImportNamespaceSpecifier')
        ) {
          context.report({ node, message })
        }
      },
      // 動的 import() は戻りが名前空間オブジェクトなので同じ扱いにする
      ImportExpression(node) {
        if (node.source.type === 'Literal' && isLocalSource(node.source.value)) {
          context.report({ node, message })
        }
      },
      ExportAllDeclaration(node) {
        // `export * as ns from './x'` は名前空間の取り込み。素の `export *` は別ルールが見る
        if (node.exported && isLocalSource(node.source.value)) {
          context.report({ node, message })
        }
      },
    }
  },
}

const noEnum = {
  meta: { type: 'suggestion', docs: { description: 'enum を使わない' } },
  create(context) {
    return {
      TSEnumDeclaration(node) {
        context.report({
          node,
          message:
            'enum は使えません。as const のオブジェクトか、文字列リテラルのユニオン型を使ってください。',
        })
      },
    }
  },
}

const noDelete = {
  meta: { type: 'suggestion', docs: { description: 'delete 演算子を使わない' } },
  create(context) {
    return {
      UnaryExpression(node) {
        if (node.operator === 'delete' && node.argument.type === 'MemberExpression') {
          context.report({
            node,
            message:
              'delete はオブジェクトの形を壊して遅くなります。undefined を代入するか、分割代入で除いた新しいオブジェクトを作ってください。',
          })
        }
      },
    }
  },
}

const noReExportAll = {
  meta: { type: 'suggestion', docs: { description: 'export * from を使わない' } },
  create(context) {
    return {
      ExportAllDeclaration(node) {
        context.report({
          node,
          message:
            'export * は tree-shaking を妨げます。必要な名前だけを named export で再公開してください。',
        })
      },
    }
  },
}

export default {
  meta: { name: 'treemo' },
  rules: {
    'no-raw-date': noRawDate,
    'no-namespace-import': noNamespaceImport,
    'no-enum': noEnum,
    'no-delete': noDelete,
    'no-re-export-all': noReExportAll,
  },
}
