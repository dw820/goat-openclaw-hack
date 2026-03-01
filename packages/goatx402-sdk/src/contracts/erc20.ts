/**
 * ERC20 Token Contract Helpers
 */

import { ethers } from 'ethers'
import ERC20_ABI from '../abis/ERC20.json'

export class ERC20Token {
  private contract: ethers.Contract

  constructor(
    tokenAddress: string,
    signerOrProvider: ethers.Signer | ethers.Provider
  ) {
    this.contract = new ethers.Contract(tokenAddress, ERC20_ABI, signerOrProvider)
  }

  /**
   * Get token balance
   */
  async balanceOf(address: string): Promise<bigint> {
    return this.contract.balanceOf(address)
  }

  /**
   * Get token allowance
   */
  async allowance(owner: string, spender: string): Promise<bigint> {
    return this.contract.allowance(owner, spender)
  }

  /**
   * Get token decimals
   */
  async decimals(): Promise<number> {
    return this.contract.decimals()
  }

  /**
   * Get token symbol
   */
  async symbol(): Promise<string> {
    return this.contract.symbol()
  }

  /**
   * Approve spender to transfer tokens
   */
  async approve(
    spender: string,
    amount: bigint
  ): Promise<ethers.TransactionResponse> {
    return this.contract.approve(spender, amount)
  }

  /**
   * Transfer tokens to recipient
   */
  async transfer(
    to: string,
    amount: bigint
  ): Promise<ethers.TransactionResponse> {
    return this.contract.transfer(to, amount)
  }

  /**
   * Check if approval is needed and approve if necessary
   * Returns true if a new approval transaction was sent
   */
  async ensureApproval(
    owner: string,
    spender: string,
    amount: bigint
  ): Promise<{ needed: boolean; tx?: ethers.TransactionResponse }> {
    const currentAllowance = await this.allowance(owner, spender)

    if (currentAllowance >= amount) {
      return { needed: false }
    }

    // Approve max uint256 for better UX (fewer future approvals)
    const tx = await this.approve(spender, ethers.MaxUint256)
    return { needed: true, tx }
  }
}

/**
 * Parse amount string to wei (bigint)
 */
export function parseUnits(amount: string, decimals: number): bigint {
  return ethers.parseUnits(amount, decimals)
}

/**
 * Format wei to human-readable amount
 */
export function formatUnits(amount: bigint, decimals: number): string {
  return ethers.formatUnits(amount, decimals)
}
