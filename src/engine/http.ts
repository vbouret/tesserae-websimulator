export interface HttpRequest {
  method: 'GET' | 'POST'
  url: string
  headers?: Record<string, string>
  body?: string
}

export interface HttpResponse {
  status: number
  /** Lower-cased header names. Only CORS-exposed headers are visible in a browser. */
  headers: Record<string, string>
  body: Uint8Array
}

export type HttpErrorKind = 'network' | 'mixed-content' | 'timeout'

export class HttpError extends Error {
  constructor(
    public kind: HttpErrorKind,
    message: string,
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

export interface Http {
  request(req: HttpRequest): Promise<HttpResponse>
}

export const textOf = (r: HttpResponse) => new TextDecoder().decode(r.body)
export const jsonOf = <T = Record<string, unknown>>(r: HttpResponse): T | null => {
  try {
    return JSON.parse(textOf(r)) as T
  } catch {
    return null
  }
}

export class FetchHttp implements Http {
  constructor(private timeoutMs = 30_000) {}
  async request(req: HttpRequest): Promise<HttpResponse> {
    const ctl = new AbortController()
    const timer = setTimeout(() => ctl.abort(), this.timeoutMs)
    try {
      const res = await fetch(req.url, {
        method: req.method,
        headers: req.headers,
        body: req.body,
        signal: ctl.signal,
        cache: 'no-store',
      })
      const headers: Record<string, string> = {}
      res.headers.forEach((v, k) => (headers[k.toLowerCase()] = v))
      return { status: res.status, headers, body: new Uint8Array(await res.arrayBuffer()) }
    } catch (e) {
      if (ctl.signal.aborted) throw new HttpError('timeout', `Timed out after ${this.timeoutMs} ms`)
      const page = typeof location !== 'undefined' ? location.protocol : ''
      if (page === 'https:' && req.url.startsWith('http://')) {
        throw new HttpError(
          'mixed-content',
          'Blocked: this page is HTTPS but the Tesserae server is plain HTTP. Put Tesserae behind HTTPS, or open the simulator over HTTP.',
        )
      }
      throw new HttpError(
        'network',
        `Request failed (${(e as Error).message}). Server unreachable, or it does not allow CORS from this origin.`,
      )
    } finally {
      clearTimeout(timer)
    }
  }
}

export interface HttpLogEntry {
  id: number
  at: number
  method: string
  url: string
  reqHeaders: Record<string, string>
  reqBody?: string
  status?: number
  resHeaders?: Record<string, string>
  /** Text for JSON bodies, a size note for binary. */
  resBody?: string
  resBytes?: number
  ms: number
  error?: string
}

let logSeq = 0
const redact = (h: Record<string, string> = {}) => {
  const out = { ...h }
  for (const k of Object.keys(out)) {
    if (/authorization/i.test(k)) out[k] = out[k].replace(/(Bearer\s+)(.{4}).*/, '$1$2…')
  }
  return out
}

/** Wraps an Http and reports every exchange to the inspector. */
export class LoggingHttp implements Http {
  constructor(
    private inner: Http,
    private now: () => number,
    private sink: (e: HttpLogEntry) => void,
  ) {}
  async request(req: HttpRequest): Promise<HttpResponse> {
    const start = this.now()
    const base = {
      id: ++logSeq,
      at: start,
      method: req.method,
      url: req.url,
      reqHeaders: redact(req.headers),
      reqBody: req.body,
    }
    try {
      const res = await this.inner.request(req)
      const ct = res.headers['content-type'] ?? ''
      const isText = /json|text/.test(ct) || (res.body.length < 4096 && res.status !== 200)
      this.sink({
        ...base,
        status: res.status,
        resHeaders: res.headers,
        resBody: isText ? textOf(res) : undefined,
        resBytes: res.body.length,
        ms: this.now() - start,
      })
      return res
    } catch (e) {
      this.sink({ ...base, ms: this.now() - start, error: (e as Error).message })
      throw e
    }
  }
}
