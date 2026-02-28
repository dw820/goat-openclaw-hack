import { Readable } from 'node:stream'
import type { Response } from 'express'

export interface ChatCompletionRequest {
  model: string
  messages: Array<{ role: string; content: string }>
  stream?: boolean
  [key: string]: unknown
}

export async function proxyToOllama(body: ChatCompletionRequest, res: Response): Promise<void> {
  const ollamaEndpoint = process.env.OLLAMA_ENDPOINT ?? 'http://localhost:11434'
  const url = `${ollamaEndpoint}/v1/chat/completions`

  let upstream: globalThis.Response
  try {
    upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, stream: true }),
    })
  } catch (err) {
    res.status(502).json({
      error: 'upstream_unreachable',
      message: `Cannot reach Ollama at ${ollamaEndpoint}: ${err instanceof Error ? err.message : String(err)}`,
    })
    return
  }

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => 'unknown error')
    res.status(upstream.status).json({
      error: 'upstream_error',
      message: `Ollama returned ${upstream.status}: ${text}`,
    })
    return
  }

  if (!upstream.body) {
    res.status(502).json({ error: 'upstream_error', message: 'No response body from Ollama' })
    return
  }

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  const nodeStream = Readable.fromWeb(upstream.body as any)
  nodeStream.pipe(res)

  nodeStream.on('error', (err) => {
    console.error('[proxy] Stream error:', err.message)
    if (!res.headersSent) {
      res.status(502).json({ error: 'stream_error', message: err.message })
    } else {
      res.end()
    }
  })
}

export async function checkOllamaHealth(): Promise<'reachable' | 'unreachable'> {
  const ollamaEndpoint = process.env.OLLAMA_ENDPOINT ?? 'http://localhost:11434'
  try {
    const res = await fetch(ollamaEndpoint, { signal: AbortSignal.timeout(3000) })
    return res.ok ? 'reachable' : 'unreachable'
  } catch {
    return 'unreachable'
  }
}
