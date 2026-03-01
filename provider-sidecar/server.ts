import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { createOrder, verifyOrder, isMockMode } from './x402-client.js'
import { proxyToOllama, checkOllamaHealth, getOllamaModels } from './proxy.js'
import type { ChatCompletionRequest } from './proxy.js'
import { createLogger } from './logger.js'

const log = createLogger('server')

const app = express()
app.use(cors())
app.use(express.json())

// POST /v1/chat/completions — payment-gated inference
app.post('/v1/chat/completions', async (req, res) => {
  const body = req.body as ChatCompletionRequest
  const orderId = req.headers['x-goat-order-id'] as string | undefined

  log.info('Inference request', { model: body.model, hasOrderId: !!orderId })

  // Mock mode: bypass payment entirely
  if (isMockMode()) {
    log.debug('Mock mode — bypassing payment')
    await proxyToOllama(body, res)
    return
  }

  if (!orderId) {
    // No payment — create order and return 402
    const walletAddress = req.headers['x-wallet-address'] as string | undefined
    if (!walletAddress) {
      res.status(400).json({
        error: 'wallet_address_required',
        message: 'X-Wallet-Address header is required for payment',
      })
      return
    }

    try {
      const amount = process.env.PRICE_AMOUNT ?? '0.01'
      const symbol = process.env.PRICE_SYMBOL ?? 'USDC'
      const order = await createOrder(amount, symbol, walletAddress)
      log.info('Order created', { orderId: order.orderId, amount, symbol })
      res.status(402).json({
        error: 'payment_required',
        message: 'x402 payment required for inference',
        order,
      })
    } catch (err) {
      log.error('Order creation failed', err)
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
    log.info('Order verified', { orderId, status: status.status })
    if (status.status === 'PAYMENT_CONFIRMED' || status.status === 'INVOICED') {
      log.debug('Payment confirmed, proxying to Ollama')
      await proxyToOllama(body, res)
    } else {
      res.status(402).json({
        error: 'payment_pending',
        message: `Order ${orderId} status: ${status.status}`,
        order: status,
      })
    }
  } catch (err) {
    log.error('Order verification failed', err)
    res.status(500).json({
      error: 'order_verification_failed',
      message: err instanceof Error ? err.message : String(err),
    })
  }
})

// GET /api/orders/:orderId/status — order polling
app.get('/api/orders/:orderId/status', async (req, res) => {
  const { orderId } = req.params
  log.debug('Order status poll', { orderId })

  if (isMockMode()) {
    res.json({ orderId, status: 'PAYMENT_CONFIRMED', confirmedAt: new Date().toISOString(), txHash: '0xmock' })
    return
  }

  try {
    const status = await verifyOrder(orderId)
    res.json(status)
  } catch (err) {
    log.error('Order status check failed', err)
    res.status(500).json({
      error: 'order_status_failed',
      message: err instanceof Error ? err.message : String(err),
    })
  }
})

// GET /models — list available Ollama models
app.get('/models', async (_req, res) => {
  log.debug('Models requested')
  const models = await getOllamaModels()
  res.json({ models })
})

// GET /health — health check
app.get('/health', async (_req, res) => {
  const ollamaEndpoint = process.env.OLLAMA_ENDPOINT ?? 'http://localhost:11434'
  const ollamaStatus = await checkOllamaHealth()
  log.debug('Health check', { ollamaStatus })
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
  log.info(`Provider sidecar running on http://localhost:${port}`)
  log.info(`Mock payments: ${isMockMode()}`)
  log.info(`Ollama endpoint: ${process.env.OLLAMA_ENDPOINT ?? 'http://localhost:11434'}`)
})
