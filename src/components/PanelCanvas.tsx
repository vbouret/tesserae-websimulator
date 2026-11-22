import { useEffect, useRef } from 'react'
import type { DisplayState } from '@/engine/nvs'
import { decoders } from '@/panel/decoders'
import type { DeviceProfile } from '@/profiles'

function drawSplash(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  d: Extract<DisplayState, { kind: 'splash' }>,
) {
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, w, h)
  ctx.strokeStyle = '#000'
  ctx.lineWidth = 4
  ctx.strokeRect(24, 24, w - 48, h - 48)
  ctx.fillStyle = '#000'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = 'bold 22px sans-serif'
  ctx.fillText('TESSERAE', w / 2, 80)
  ctx.font = 'bold 46px sans-serif'
  ctx.fillText(d.title, w / 2, h / 2 - 30 - (d.lines.length - 1) * 14)
  ctx.font = '28px sans-serif'
  d.lines.forEach((l, i) => ctx.fillText(l, w / 2, h / 2 + 30 + i * 38 - (d.lines.length - 1) * 14))
}

function paint(ctx: CanvasRenderingContext2D, profile: DeviceProfile, display: DisplayState) {
  const { panelW: w, panelH: h } = profile
  if (display.kind === 'frame') {
    const rgba = decoders[profile.format].decode(display.bytes, w, h)
    ctx.putImageData(new ImageData(rgba as Uint8ClampedArray<ArrayBuffer>, w, h), 0, 0)
  } else if (display.kind === 'splash') {
    drawSplash(ctx, w, h, display)
  } else {
    ctx.fillStyle = '#d8d8d0'
    ctx.fillRect(0, 0, w, h)
  }
}

/** Draws the panel, optionally with the black/white e-ink flash sequence first. */
export function PanelCanvas({
  profile,
  display,
  seq,
  animate,
  fast,
  zoom,
}: {
  profile: DeviceProfile
  display: DisplayState
  seq: number
  animate: boolean
  fast: boolean
  zoom: 'fit' | '1:1'
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const latest = useRef(display)
  latest.current = display

  useEffect(() => {
    const ctx = ref.current!.getContext('2d')!
    const { panelW: w, panelH: h } = profile
    if (!animate) {
      paint(ctx, profile, latest.current)
      return
    }
    const step = fast ? 50 : 550
    const colors = ['#000', '#fff', '#000', '#fff', '#000', '#fff']
    let i = 0
    let timer: ReturnType<typeof setTimeout>
    const tick = () => {
      if (i < colors.length) {
        ctx.fillStyle = colors[i++]
        ctx.fillRect(0, 0, w, h)
        timer = setTimeout(tick, step)
      } else {
        paint(ctx, profile, latest.current)
      }
    }
    tick()
    return () => clearTimeout(timer)
    // seq changes on every repaint; display itself is read via ref.
  }, [seq, profile, animate, fast])

  return (
    <canvas
      ref={ref}
      width={profile.panelW}
      height={profile.panelH}
      className="panel block bg-white"
      style={zoom === 'fit' ? { width: '100%', height: 'auto' } : { width: profile.panelW }}
    />
  )
}
