import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { createOrder, verifyOrder, isMockMode } from './x402-client.js'
import { proxyToOllama, checkOllamaHealth } from './proxy.js'
import type { ChatCompletionRequest } from './proxy.js'

const app = express()
app.use(cors())
app.use(express.json())

// POST /v1/chat/completions — payment-gated inference
app.post('/v1/chat/completions', async (req, res) => {
  const body = req.body as ChatCompletionRequest

  // Mock mode: bypass payment entirely
  if (isMockMode()) {
    console.log('[mock] MOCK MODE: bypassing payment, proxying to Ollama')
    await proxyToOllama(body, res)
    return
  }

  const orderId = req.headers['x-goat-order-id'] as string | undefined

  if (!orderId) {
    // No payment — create order and return 402
    try {
      const amount = process.env.PRICE_AMOUNT ?? '0.01'
      const symbol = process.env.PRICE_SYMBOL ?? 'USDC'
      const order = await createOrder(amount, symbol)
      res.status(402).json({
        error: 'payment_required',
        message: 'x402 payment required for inference',
        order,
      })
    } catch (err) {
      console.error('[server] createOrder error:', err)
      res.status(500).json({
        error: 'order_creation_failed',
        message: err instanceof Error ? err.message : String(err),
      })
    }
    return
  }

  // Has order ID — verify payment
  try {
    const status = await verifyOrder(orderId)
    if (status.status === 'paid') {
      await proxyToOllama(body, res)
    } else {
      res.status(402).json({
        error: 'payment_pending',
        message: `Order ${orderId} status: ${status.status}`,
        order: status,
      })
    }
  } catch (err) {
    console.error('[server] verifyOrder error:', err)
    res.status(500).json({
      error: 'order_verification_failed',
      message: err instanceof Error ? err.message : String(err),
    })
  }
})

// GET /api/orders/:orderId/status — order polling
app.get('/api/orders/:orderId/status', async (req, res) => {
  const { orderId } = req.params

  if (isMockMode()) {
    res.json({ orderId, status: 'paid', paidAt: new Date().toISOString(), txHash: '0xmock' })
    return
  }

  try {
    const status = await verifyOrder(orderId)
    res.json(status)
  } catch (err) {
    console.error('[server] order status error:', err)
    res.status(500).json({
      error: 'order_status_failed',
      message: err instanceof Error ? err.message : String(err),
    })
  }
})

// GET /health — health check
app.get('/health', async (_req, res) => {
  const ollamaEndpoint = process.env.OLLAMA_ENDPOINT ?? 'http://localhost:11434'
  const ollamaStatus = await checkOllamaHealth()
  res.json({
    status: 'ok',
    provider: 'ollama',
    ollamaEndpoint,
    ollamaStatus,
    mockPayments: isMockMode(),
  })
})

const port = parseInt(process.env.PROVIDER_PORT ?? '4021', 10)
app.listen(port, () => {
  console.log(`[sidecar] Provider sidecar running on http://localhost:${port}`)
  console.log(`[sidecar] Mock payments: ${isMockMode()}`)
  console.log(`[sidecar] Ollama endpoint: ${process.env.OLLAMA_ENDPOINT ?? 'http://localhost:11434'}`)
})
