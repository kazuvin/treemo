/**
 * BGM。テーマの写真に合わせた環境音を、つなぎ目なく繰り返して流す。
 * 考え方と音の出どころは docs/kotoba-design-system.md の「BGM」。
 */
import ame from '@/assets/ambience/ame.mp3'
import kawa from '@/assets/ambience/kawa.mp3'
import mori from '@/assets/ambience/mori.mp3'
import takibi from '@/assets/ambience/takibi.mp3'
import umi from '@/assets/ambience/umi.mp3'
import yama from '@/assets/ambience/yama.mp3'
import yoru from '@/assets/ambience/yoru.mp3'

export const AMBIENCES = [
  { id: 'yama', label: '山の風', src: yama },
  { id: 'kawa', label: '渓流', src: kawa },
  { id: 'umi', label: '波', src: umi },
  { id: 'mori', label: '森の鳥', src: mori },
  { id: 'yoru', label: '夏の夜の虫', src: yoru },
  { id: 'takibi', label: '焚き火', src: takibi },
  { id: 'ame', label: '雨', src: ame },
] as const

export type Ambience = (typeof AMBIENCES)[number]

export type AmbienceId = Ambience['id']

/** 流す音。`off` は流さない、`theme` はテーマに合わせる、ほかはテーマによらずその音 */
export type BgmChoice = 'off' | 'theme' | AmbienceId

export const DEFAULT_BGM: BgmChoice = 'off'

/** 音量（%）。聞こえ方に合わせ、流すときは 2 乗して掛ける */
export const BGM_VOLUMES = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100] as const

export const DEFAULT_BGM_VOLUME = 50

function ambienceOf(id: string | null): Ambience | null {
  return AMBIENCES.find((a) => a.id === id) ?? null
}

/** 保存した値を読む。知らない値は流さない */
export function sanitizeBgm(value: string): BgmChoice {
  if (value === 'off' || value === 'theme') {
    return value
  }
  return ambienceOf(value)?.id ?? DEFAULT_BGM
}

/** 選べる音量のうち、いちばん近いものに寄せる */
export function sanitizeBgmVolume(volume: number): number {
  if (!Number.isFinite(volume)) {
    return DEFAULT_BGM_VOLUME
  }
  return BGM_VOLUMES.reduce((best, v) =>
    Math.abs(v - volume) < Math.abs(best - volume) ? v : best,
  )
}

/** 1 段大きく（delta = 1）/ 小さく（-1）する。端ではそのまま */
export function stepBgmVolume(volume: number, delta: 1 | -1): number {
  const index = BGM_VOLUMES.indexOf(sanitizeBgmVolume(volume) as (typeof BGM_VOLUMES)[number])
  return BGM_VOLUMES[Math.min(Math.max(index + delta, 0), BGM_VOLUMES.length - 1)] ?? volume
}

/** 今流す音。テーマに合わせるなら、テーマの音（無ければ流さない） */
export function currentAmbience(
  choice: BgmChoice,
  themeAmbience: AmbienceId | null,
): Ambience | null {
  if (choice === 'off') {
    return null
  }
  return ambienceOf(choice === 'theme' ? themeAmbience : choice)
}

export function bgmChoiceLabel(choice: BgmChoice): string {
  if (choice === 'off') {
    return '流さない'
  }
  if (choice === 'theme') {
    return 'テーマに合わせる'
  }
  return ambienceOf(choice)?.label ?? choice
}

export const BGM_CHOICES: readonly BgmChoice[] = ['off', 'theme', ...AMBIENCES.map((a) => a.id)]
