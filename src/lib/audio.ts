/** Buzzer: pattern is "freq:ms,freq:ms,..." (freq 0 = rest). */
export function parsePattern(p: string): { freq: number; ms: number }[] {
  return p
    .split(',')
    .map((s) => s.trim().split(':'))
    .map(([f, m]) => ({ freq: Number(f), ms: Number(m) }))
    .filter((t) => Number.isFinite(t.freq) && Number.isFinite(t.ms) && t.ms > 0)
}

let ctx: AudioContext | null = null

export function playBeep(pattern: string, volume: number) {
  try {
    ctx ??= new AudioContext()
    const ac = ctx
    void ac.resume()
    let t = ac.currentTime + 0.02
    const gain = Math.max(0, Math.min(1, volume / 100)) * 0.2
    for (const { freq, ms } of parsePattern(pattern)) {
      if (freq > 0) {
        const osc = ac.createOscillator()
        const g = ac.createGain()
        osc.type = 'square'
        osc.frequency.value = freq
        g.gain.value = gain
        osc.connect(g).connect(ac.destination)
        osc.start(t)
        osc.stop(t + ms / 1000)
      }
      t += ms / 1000
    }
  } catch {
    /* audio blocked until a user gesture; ignore */
  }
}
