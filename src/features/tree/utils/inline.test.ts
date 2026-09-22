import { parseInline, plainText } from './inline'

describe('parseInline', () => {
  it('reads strong, emphasis, code, strikethrough and links', () => {
    expect(parseInline('**a** *b* `c` ~~d~~ [e](https://x)')).toEqual([
      { kind: 'strong', children: [{ kind: 'text', text: 'a' }] },
      { kind: 'text', text: ' ' },
      { kind: 'em', children: [{ kind: 'text', text: 'b' }] },
      { kind: 'text', text: ' ' },
      { kind: 'code', text: 'c' },
      { kind: 'text', text: ' ' },
      { kind: 'strike', children: [{ kind: 'text', text: 'd' }] },
      { kind: 'text', text: ' ' },
      { kind: 'link', href: 'https://x', children: [{ kind: 'text', text: 'e' }] },
    ])
  })

  it('nests emphasis inside strong', () => {
    expect(parseInline('**a *b* c**')).toEqual([
      {
        kind: 'strong',
        children: [
          { kind: 'text', text: 'a ' },
          { kind: 'em', children: [{ kind: 'text', text: 'b' }] },
          { kind: 'text', text: ' c' },
        ],
      },
    ])
  })

  it('does not read markup inside code', () => {
    expect(parseInline('`**x**`')).toEqual([{ kind: 'code', text: '**x**' }])
  })

  it('leaves unmatched markers and escapes as text', () => {
    expect(parseInline('a * b \\*c\\*')).toEqual([{ kind: 'text', text: 'a * b *c*' }])
    expect(parseInline('snake_case_name')).toEqual([{ kind: 'text', text: 'snake_case_name' }])
  })
})

describe('plainText', () => {
  it('drops the markup and joins lines', () => {
    expect(plainText('**値引き**が増えた\n[詳細](x)')).toBe('値引きが増えた 詳細')
  })
})
