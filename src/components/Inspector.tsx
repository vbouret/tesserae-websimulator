import { useMemo, useState } from 'react'
import { useSim } from '@/store/sim'
import { decoders } from '@/panel/decoders'
import { getProfile } from '@/profiles'
import { Button, Card } from './ui/primitives'

const time = (t: number) => new Date(t).toLocaleTimeString()
const tabs = ['HTTP', 'Timeline', 'NVS', 'Frame'] as const

export function Inspector({ id }: { id: string }) {
  const [tab, setTab] = useState<(typeof tabs)[number]>('HTTP')
  return (
    <Card>
      <div className="mb-3 flex gap-1">
        {tabs.map((t) => (
          <Button key={t} variant={t === tab ? 'default' : 'ghost'} onClick={() => setTab(t)}>
            {t}
          </Button>
        ))}
      </div>
      {tab === 'HTTP' && <HttpLog id={id} />}
      {tab === 'Timeline' && <Timeline id={id} />}
      {tab === 'NVS' && <NvsView id={id} />}
      {tab === 'Frame' && <FrameView id={id} />}
    </Card>
  )
}

function HttpLog({ id }: { id: string }) {
  const log = useSim((s) => s.runtime[id]?.http) ?? []
  if (!log.length) return <p className="text-sm text-muted">No requests yet.</p>
  return (
    <div className="max-h-96 space-y-1 overflow-auto font-mono text-xs">
      {[...log].reverse().map((e) => (
        <details key={e.id} className="rounded bg-sunk px-2 py-1">
          <summary className="cursor-pointer">
            <span className="text-muted">{time(e.at)}</span> {e.method}{' '}
            <span className={e.error || (e.status ?? 0) >= 400 ? 'text-danger' : 'text-ok'}>
              {e.error ? 'ERR' : e.status}
            </span>{' '}
            {e.url.replace(/^https?:\/\/[^/]+/, '')} <span className="text-muted">{e.ms} ms</span>
          </summary>
          <pre className="mt-1 break-all whitespace-pre-wrap text-ink-soft">
            {[
              e.url,
              '— request headers —',
              JSON.stringify(e.reqHeaders, null, 1),
              e.reqBody && `— request body —\n${e.reqBody}`,
              e.error
                ? `— error —\n${e.error}`
                : `— response headers —\n${JSON.stringify(e.resHeaders, null, 1)}`,
              e.resBody
                ? `— response body —\n${e.resBody}`
                : e.resBytes !== undefined && `— ${e.resBytes} bytes (binary) —`,
            ]
              .filter(Boolean)
              .join('\n')}
          </pre>
        </details>
      ))}
    </div>
  )
}

function Timeline({ id }: { id: string }) {
  const tl = useSim((s) => s.runtime[id]?.timeline) ?? []
  return (
    <div className="max-h-96 overflow-auto font-mono text-xs">
      {[...tl].reverse().map((e, i) => (
        <div
          key={i}
          className={
            e.level === 'error'
              ? 'text-danger'
              : e.level === 'warn'
                ? 'text-amber-300'
                : e.kind === 'sleep'
                  ? 'text-sky-300'
                  : ''
          }
        >
          <span className="text-muted">{time(e.at)}</span> {e.text}
        </div>
      ))}
      {!tl.length && <p className="text-muted">Nothing yet.</p>}
    </div>
  )
}

function NvsView({ id }: { id: string }) {
  const nvs = useSim((s) => s.runtime[id]?.nvs)
  if (!nvs) return null
  const { display, ...rest } = nvs
  const shown = {
    ...rest,
    display: display.kind === 'frame' ? `frame (${display.bytes.length} B)` : display,
  }
  return (
    <pre className="max-h-96 overflow-auto font-mono text-xs text-ink">
      {JSON.stringify(shown, null, 2)}
    </pre>
  )
}

function FrameView({ id }: { id: string }) {
  const rt = useSim((s) => s.runtime[id])
  const display = rt?.display
  const stats = useMemo(() => {
    if (!rt || display?.kind !== 'frame') return null
    const p = getProfile(rt.profileId)
    const px = decoders[p.format].decode(display.bytes, p.panelW, p.panelH)
    const hist = new Map<number, number>()
    for (let i = 0; i < px.length; i += 4) hist.set(px[i], (hist.get(px[i]) ?? 0) + 1)
    return { p, hist: [...hist.entries()].sort((a, b) => a[0] - b[0]), total: p.panelW * p.panelH }
  }, [rt, display])
  if (!display || display.kind !== 'frame' || !stats)
    return <p className="text-sm text-muted">No frame has been painted.</p>
  const hex = Array.from(display.bytes.slice(0, 256), (b) => b.toString(16).padStart(2, '0'))
  const rows: string[] = []
  for (let i = 0; i < hex.length; i += 16)
    rows.push(`${i.toString(16).padStart(4, '0')}  ${hex.slice(i, i + 16).join(' ')}`)
  const download = () => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([display.bytes as Uint8Array<ArrayBuffer>]))
    a.download = `frame-${display.renderId ?? 'latest'}.bin`
    a.click()
  }
  return (
    <div className="space-y-2 text-xs">
      <p>
        {stats.p.format} · {display.bytes.length} B · render {display.renderId ?? '—'}
      </p>
      <p>
        {stats.hist.map(([v, n]) => `L${v}: ${((n / stats.total) * 100).toFixed(1)}%`).join('  ')}
      </p>
      <pre className="font-mono text-ink-soft">{rows.join('\n')}</pre>
      <Button onClick={download}>Download .bin</Button>
    </div>
  )
}
