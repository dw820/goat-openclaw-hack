import crypto from 'node:crypto'

export interface Order {
  orderId: string
  amount: string
  symbol: string
  chainId: number
  merchantId: string
  paymentUrl: string
}

export interface OrderStatus {
  orderId: string
  status: 'paid' | 'pending' | 'expired'
  paidAt?: string
  txHash?: string
}

export function isMockMode(): boolean {
  return process.env.MOCK_PAYMENTS === 'true'
}

// Try SDK first, fall back to REST
let sdkClient: any = null
let useSdk = false

try {
  const sdk = await import('goatx402-sdk-server')
  const GoatX402 = sdk.GoatX402 ?? sdk.default
  if (GoatX402) {
    sdkClient = new GoatX402({
      apiUrl: process.env.GOATX402_API_URL,
      apiKey: process.env.GOATX402_API_KEY,
      apiSecret: process.env.GOATX402_API_SECRET,
      merchantId: process.env.GOATX402_MERCHANT_ID,
    })
    useSdk = true
    console.log('[x402] Using goatx402-sdk-server SDK')
  }
} catch {
  console.log('[x402] SDK not available, using REST fallback')
}

// HMAC signature for REST fallback
function hmacSign(payload: string): string {
  const secret = process.env.GOATX402_API_SECRET ?? ''
  return crypto.createHmac('sha256', secret).update(payload).digest('hex')
}

function restHeaders(body?: string): Record<string, string> {
  const timestamp = Date.now().toString()
  const payload = body ? `${timestamp}${body}` : timestamp
  return {
    'Content-Type': 'application/json',
    'X-API-Key': process.env.GOATX402_API_KEY ?? '',
    'X-Timestamp': timestamp,
    'X-Signature': hmacSign(payload),
  }
}

export async function createOrder(amount: string, symbol: string): Promise<Order> {
  const merchantId = process.env.GOATX402_MERCHANT_ID ?? ''

  if (useSdk && sdkClient) {
    const order = await sdkClient.createOrder({ amount, symbol })
    return {
      orderId: order.orderId ?? order.id,
      amount: order.amount ?? amount,
      symbol: order.symbol ?? symbol,
      chainId: order.chainId ?? 48816,
      merchantId: order.merchantId ?? merchantId,
      paymentUrl: order.paymentUrl ?? order.payment_url ?? '',
    }
  }

  // REST fallback
  const apiUrl = process.env.GOATX402_API_URL ?? ''
  const body = JSON.stringify({ amount, symbol, merchantId })
  const res = await fetch(`${apiUrl}/orders`, {
    method: 'POST',
    headers: restHeaders(body),
    body,
  })

  if (!res.ok) {
    throw new Error(`x402 createOrder failed: ${res.status} ${await res.text()}`)
  }

  const data = await res.json() as any
  return {
    orderId: data.orderId ?? data.id,
    amount: data.amount ?? amount,
    symbol: data.symbol ?? symbol,
    chainId: data.chainId ?? 48816,
    merchantId: data.merchantId ?? merchantId,
    paymentUrl: data.paymentUrl ?? data.payment_url ?? `${apiUrl}/pay/${data.orderId ?? data.id}`,
  }
}

export async function verifyOrder(orderId: string): Promise<OrderStatus> {
  if (useSdk && sdkClient) {
    const status = await sdkClient.getOrderStatus(orderId)
    return {
      orderId: status.orderId ?? orderId,
      status: status.status ?? 'pending',
      paidAt: status.paidAt,
      txHash: status.txHash,
    }
  }

  // REST fallback
  const apiUrl = process.env.GOATX402_API_URL ?? ''
  const res = await fetch(`${apiUrl}/orders/${orderId}`, {
    method: 'GET',
    headers: restHeaders(),
  })

  if (!res.ok) {
    throw new Error(`x402 verifyOrder failed: ${res.status} ${await res.text()}`)
  }

  const data = await res.json() as any
  return {
    orderId: data.orderId ?? orderId,
    status: data.status ?? 'pending',
    paidAt: data.paidAt,
    txHash: data.txHash,
  }
}
