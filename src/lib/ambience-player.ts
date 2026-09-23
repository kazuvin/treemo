/**
 * 環境音を流す。MP3 は頭と尻に無音が入り、そのまま繰り返すと境目で途切れるので、
 * Web Audio で終わりの OVERLAP 秒を次の頭と重ねて（等パワーで）つなぐ。
 * 音を替えるときは今の音を FADE 秒で消しながら次の音を入れる。
 */
const FADE_SECONDS = 1.5
const OVERLAP_SECONDS = 4
const CURVE_STEPS = 64

/** 等パワーのクロスフェードの曲線。重ねている間も音の大きさが沈まない */
const FADE_IN = Float32Array.from({ length: CURVE_STEPS }, (_, i) =>
  Math.sin(((i / (CURVE_STEPS - 1)) * Math.PI) / 2),
)
const FADE_OUT = FADE_IN.slice().reverse()

interface Playing {
  /** この音の出口。止めるときはここを絞る */
  bus: GainNode
  sources: Set<AudioBufferSourceNode>
  timer: ReturnType<typeof setTimeout> | null
}

let context: AudioContext | null = null
let master: GainNode | null = null
let volume = 0
let wanted: string | null = null
let playing: Playing | null = null
const buffers = new Map<string, Promise<AudioBuffer>>()

function audio(): { context: AudioContext; master: GainNode } | null {
  if (typeof AudioContext === 'undefined') {
    return null
  }
  if (!context || !master) {
    context = new AudioContext()
    master = context.createGain()
    master.gain.value = volume
    master.connect(context.destination)
    // WebView は操作を受けるまで音を出させない。最初のキーかクリックで鳴らし始める
    const resume = () => {
      if (context?.state === 'suspended') {
        void context.resume()
      }
    }
    window.addEventListener('keydown', resume, { capture: true })
    window.addEventListener('pointerdown', resume, { capture: true })
  }
  return { context, master }
}

function load(ctx: AudioContext, src: string): Promise<AudioBuffer> {
  let buffer = buffers.get(src)
  if (!buffer) {
    buffer = fetch(src)
      .then((response) => response.arrayBuffer())
      .then((data) => ctx.decodeAudioData(data))
    buffers.set(src, buffer)
    buffer.catch(() => buffers.delete(src))
  }
  return buffer
}

/** at から 1 回分を流し、次の回をその終わりに重ねて予約する */
function loopFrom(ctx: AudioContext, buffer: AudioBuffer, target: Playing, at: number): void {
  const overlap = Math.min(OVERLAP_SECONDS, buffer.duration / 3)
  const gain = ctx.createGain()
  gain.gain.setValueCurveAtTime(FADE_IN, at, overlap)
  gain.gain.setValueCurveAtTime(FADE_OUT, at + buffer.duration - overlap, overlap)
  gain.connect(target.bus)
  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.connect(gain)
  source.onended = () => {
    target.sources.delete(source)
    gain.disconnect()
  }
  source.start(at)
  source.stop(at + buffer.duration)
  target.sources.add(source)
  const next = at + buffer.duration - overlap
  // 次の回の始まりは Web Audio の時計で決まる。タイマーはその予約に間に合えばよく、
  // 裏に回ってタイマーが遅れても 1 回分近くの余裕がある
  target.timer = setTimeout(
    () => loopFrom(ctx, buffer, target, next),
    Math.max(0, (at - ctx.currentTime) * 1000),
  )
}

function stop(ctx: AudioContext, target: Playing): void {
  if (target.timer !== null) {
    clearTimeout(target.timer)
  }
  const now = ctx.currentTime
  target.bus.gain.cancelScheduledValues(now)
  target.bus.gain.setValueAtTime(target.bus.gain.value, now)
  target.bus.gain.linearRampToValueAtTime(0, now + FADE_SECONDS)
  for (const source of target.sources) {
    source.stop(now + FADE_SECONDS)
  }
}

/** 音量（0〜100）。聞こえ方がほぼ比例するよう 2 乗して掛ける */
export function setAmbienceVolume(percent: number): void {
  volume = (percent / 100) ** 2
  if (context && master) {
    master.gain.setTargetAtTime(volume, context.currentTime, 0.1)
  }
}

/** src の音を繰り返して流す。null なら止める。同じ音なら何もしない */
export async function playAmbience(src: string | null): Promise<void> {
  if (src === wanted) {
    return
  }
  wanted = src
  const nodes = src === null && !context ? null : audio()
  if (!nodes) {
    return
  }
  const { context: ctx, master: out } = nodes
  if (playing) {
    stop(ctx, playing)
    playing = null
  }
  if (src === null) {
    return
  }
  let buffer: AudioBuffer
  try {
    buffer = await load(ctx, src)
  } catch (error) {
    console.error('BGM を読めませんでした', error)
    return
  }
  // 読んでいる間にほかの音へ替えた
  if (wanted !== src) {
    return
  }
  const bus = ctx.createGain()
  bus.connect(out)
  playing = { bus, sources: new Set(), timer: null }
  loopFrom(ctx, buffer, playing, ctx.currentTime)
}
