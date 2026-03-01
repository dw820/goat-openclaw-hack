/**
 * PaymentHelper - High-level payment execution for frontend
 *
 * This helper handles wallet interactions for executing payments.
 * Order data should be fetched from your backend.
 *
 * Payment Flow:
 * - All flows require the user to directly transfer tokens to payToAddress
 * - DIRECT mode: payToAddress = merchant address
 * - DELEGATE mode: payToAddress = TSS wallet address
 */

import { ethers } from 'ethers'
import { ERC20Token } from './contracts/erc20.js'
import { signTypedData } from './eip712/index.js'
import type { Order, PaymentResult } from './types.js'

export class PaymentHelper {
  private signer: ethers.Signer

  constructor(signer: ethers.Signer) {
    this.signer = signer
  }

  /**
   * Get the signer's address
   */
  async getAddress(): Promise<string> {
    return this.signer.getAddress()
  }

  /**
   * Execute payment based on order
   *
   * All payment flows require the user to directly transfer tokens to payToAddress.
   * The difference is only in where the tokens go:
   * - DIRECT mode: payToAddress = merchant's receiving address
   * - DELEGATE mode: payToAddress = TSS wallet address
   *
   * @param order - Order from your backend
   * @returns Payment result with transaction hash
   */
  async pay(order: Order): Promise<PaymentResult> {
    try {
      // All EVM flows require direct transfer to payToAddress
      return await this.transfer(order)
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Payment failed',
      }
    }
  }

  /**
   * Transfer tokens to payToAddress
   */
  private async transfer(order: Order): Promise<PaymentResult> {
    const token = new ERC20Token(order.tokenContract, this.signer)
    const amount = BigInt(order.amountWei)

    // Check balance
    const address = await this.getAddress()
    const balance = await token.balanceOf(address)
    if (balance < amount) {
      throw new Error(
        `Insufficient balance: have ${balance.toString()}, need ${amount.toString()}`
      )
    }

    // Transfer tokens to payToAddress
    const tx = await token.transfer(order.payToAddress, amount)
    const receipt = await tx.wait()

    if (!receipt || receipt.status !== 1) {
      throw new Error('Transaction failed')
    }

    return {
      success: true,
      txHash: receipt.hash,
    }
  }

  /**
   * Sign calldata for DELEGATE merchants
   *
   * This is only needed when order.calldataSignRequest is present.
   * The signature should be submitted to your backend which will forward it to GoatX402.
   *
   * @param order - Order with calldataSignRequest
   * @returns Signature (0x prefixed)
   */
  async signCalldata(order: Order): Promise<string> {
    if (!order.calldataSignRequest) {
      throw new Error('Order does not require calldata signature')
    }

    const signature = await signTypedData(this.signer, order.calldataSignRequest)
    return signature
  }

  /**
   * Get token balance
   */
  async getTokenBalance(tokenContract: string): Promise<bigint> {
    const token = new ERC20Token(tokenContract, this.signer)
    const address = await this.getAddress()
    return token.balanceOf(address)
  }

  /**
   * Get token allowance for a spender
   */
  async getTokenAllowance(tokenContract: string, spender: string): Promise<bigint> {
    const token = new ERC20Token(tokenContract, this.signer)
    const address = await this.getAddress()
    return token.allowance(address, spender)
  }

  /**
   * Approve tokens for a spender (rarely needed for standard flows)
   */
  async approveToken(
    tokenContract: string,
    spender: string,
    amount: bigint = ethers.MaxUint256
  ): Promise<ethers.TransactionResponse> {
    const token = new ERC20Token(tokenContract, this.signer)
    return token.approve(spender, amount)
  }

  /**
   * Transfer tokens directly (low-level, use pay() instead)
   */
  async transferToken(
    tokenContract: string,
    to: string,
    amount: bigint
  ): Promise<ethers.TransactionResponse> {
    const token = new ERC20Token(tokenContract, this.signer)
    return token.transfer(to, amount)
  }
}
