import { createCn } from 'cn/config'

/* 標準の font-size スケールに無いキー。登録しないと tailwind-merge が text-COLOUR と
   誤判定し、後続の色クラスで黙って捨てる。 */
const OFF_LADDER_FONT_SIZES = ['2xs', 'mark']

export const cn = createCn({
  extend: {
    classGroups: {
      'font-size': [{ text: OFF_LADDER_FONT_SIZES }],
    },
  },
})
