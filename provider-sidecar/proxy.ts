import { Readable } from 'node:stream'
import type { Response } from 'express'
import { createLogger } from './logger.js'

const log = createLogger('proxy')

export interface ChatCompletionRequest {
  model: string
  messages: Array<{ role: string; content: string }>
  stream?: boolean
  [key: string]: unknown
}

export async function proxyToOllama(body: ChatCompletionRequest, res: Response): Promise<void> {
  const ollamaEndpoint = process.env.OLLAMA_ENDPOINT ?? 'http://localhost:11434'
  const url = `${ollamaEndpoint}/v1/chat/completions`

  log.info('Proxying to Ollama', { url, model: body.model })

  let upstream: globalThis.Response
  try {
    upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, stream: true }),
    })
  } catch (err) {
    log.error('Ollama unreachable', err)
    res.status(502).json({
      error: 'upstream_unreachable',
      message: `Cannot reach Ollama at ${ollamaEndpoint}: ${err instanceof Error ? err.message : String(err)}`,
    })
    return
  }

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => 'unknown error')
    log.warn('Ollama returned error', { status: upstream.status, text })
    res.status(upstream.status).json({
      error: 'upstream_error',
      message: `Ollama returned ${upstream.status}: ${text}`,
    })
    return
  }

  if (!upstream.body) {
    log.warn('No response body from Ollama')
    res.status(502).json({ error: 'upstream_error', message: 'No response body from Ollama' })
    return
  }

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  log.debug('SSE stream started')
  const nodeStream = Readable.fromWeb(upstream.body as any)
  nodeStream.pipe(res)

  nodeStream.on('error', (err) => {
    log.error('Stream pipe error', err)
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
    const status = res.ok ? 'reachable' : 'unreachable'
    log.debug('Ollama health', { status })
    return status as 'reachable' | 'unreachable'
  } catch {
    log.debug('Ollama health', { status: 'unreachable' })
    return 'unreachable'
  }
}

export async function getOllamaModels(): Promise<string[]> {
  const ollamaEndpoint = process.env.OLLAMA_ENDPOINT ?? 'http://localhost:11434'
  log.debug('Fetching Ollama models')
  try {
    const res = await fetch(`${ollamaEndpoint}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    })
    if (!res.ok) return []
    const data = (await res.json()) as { models?: Array<{ name: string }> }
    const models = data.models?.map((m) => m.name) ?? []
    log.debug('Ollama models fetched', { count: models.length, models })
    return models
  } catch {
    log.debug('Ollama models fetch failed')
    return []
  }
}
