/**
 * GoatX402 Client SDK Type Definitions
 *
 * These types are used for frontend wallet interactions.
 * Order data is received from your backend (which uses goatx402-sdk-server).
 */

// ============================================================================
// Order Types (received from backend)
// ============================================================================

/**
 * Payment flow types returned by GoatX402 API.
 *
 * All flows require the user to directly transfer tokens to payToAddress.
 * The flow type indicates the receiving mode:
 * - DIRECT flows: payToAddress = merchant's receiving address
 * - DELEGATE flows (3009/APPROVE_XFER): payToAddress = TSS wallet address
 */
export type PaymentFlow =
  | 'ERC20_DIRECT'        // Direct to merchant address
  | 'ERC20_3009'          // To TSS (token supports EIP-3009)
  | 'ERC20_APPROVE_XFER'  // To TSS (token doesn't support EIP-3009)

export interface Order {
  /** Order ID from GoatX402 */
  orderId: string
  /** Payment flow type */
  flow: PaymentFlow
  /** Token symbol */
  tokenSymbol: string
  /** Token contract address */
  tokenContract: string
  /** Payer address */
  fromAddress: string
  /**
   * Recipient address for payment.
   * User should transfer tokens to this address.
   * - DIRECT mode: merchant's receiving address
   * - DELEGATE mode: TSS wallet address
   */
  payToAddress: string
  /** Chain ID */
  chainId: number
  /** Payment amount in wei */
  amountWei: string
  /** Order expiration timestamp (unix seconds) */
  expiresAt: number
  /** Calldata sign request (for DELEGATE merchants with callback) */
  calldataSignRequest?: CalldataSignRequest
}

export type OrderStatus =
  | 'CHECKOUT_VERIFIED'
  | 'PAYMENT_CONFIRMED'
  | 'INVOICED'
  | 'FAILED'
  | 'EXPIRED'
  | 'CANCELLED'

// ============================================================================
// EIP-712 Types
// ============================================================================

export interface EIP712Domain {
  name: string
  version: string
  chainId: number
  verifyingContract: string
}

export interface EIP712Type {
  name: string
  type: string
}

/**
 * Calldata sign request for EIP-712 signing.
 * Message type depends on the payment flow:
 * - EIP-3009 flow: Eip3009CalldataMessage (primaryType: "Eip3009CallbackData")
 * - Permit2 flow: Permit2CalldataMessage (primaryType: "Permit2CallbackData")
 */
export interface CalldataSignRequest {
  /** EIP-712 domain */
  domain: EIP712Domain
  /** EIP-712 types */
  types: Record<string, EIP712Type[]>
  /** Primary type name: "Eip3009CallbackData" or "Permit2CallbackData" */
  primaryType: string
  /** Message to sign - structure depends on primaryType */
  message: Eip3009CalldataMessage | Permit2CalldataMessage
}

/**
 * EIP-712 message for EIP-3009 calldata signature.
 * Used when primaryType is "Eip3009CallbackData".
 */
export interface Eip3009CalldataMessage {
  token: string         // Token contract address
  owner: string         // TSS wallet address
  payer: string         // User address (originalPayer)
  amount: string        // Payment amount in wei
  orderId: string       // Order ID hash (bytes32) - links to specific order
  calldataNonce: string // Replay protection nonce
  deadline: string      // Signature expiry timestamp
  calldataHash: string  // keccak256 hash of calldata
}

/**
 * EIP-712 message for Permit2 calldata signature.
 * Used when primaryType is "Permit2CallbackData".
 */
export interface Permit2CalldataMessage {
  permit2: string       // Permit2 contract address
  token: string         // Token contract address
  owner: string         // TSS wallet address
  payer: string         // User address (originalPayer)
  amount: string        // Payment amount in wei
  orderId: string       // Order ID hash (bytes32) - links to specific order
  calldataNonce: string // Replay protection nonce
  deadline: string      // Signature expiry timestamp
  calldataHash: string  // keccak256 hash of calldata
}

// ============================================================================
// Payment Types
// ============================================================================

export interface PaymentResult {
  /** Whether payment was successful */
  success: boolean
  /** Transaction hash (if successful) */
  txHash?: string
  /** Error message (if failed) */
  error?: string
}

// ============================================================================
// Error Types
// ============================================================================

export class PaymentError extends Error {
  code?: string
  txHash?: string

  constructor(message: string, code?: string, txHash?: string) {
    super(message)
    this.name = 'PaymentError'
    this.code = code
    this.txHash = txHash
  }
}
