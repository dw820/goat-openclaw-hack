/**
 * EIP-712 Typed Data Signing Utilities
 */

import { ethers } from 'ethers'
import type { CalldataSignRequest, EIP712Domain, EIP712Type } from '../types.js'

/**
 * Sign EIP-712 typed data using ethers.js signer
 *
 * @param signer - Ethers signer
 * @param signRequest - Calldata sign request from order
 * @returns Signature string (0x prefixed)
 */
export async function signTypedData(
  signer: ethers.Signer,
  signRequest: CalldataSignRequest
): Promise<string> {
  const domain = signRequest.domain
  const message = signRequest.message

  // Filter out EIP712Domain from types - ethers v6 handles it automatically
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { EIP712Domain, ...types } = signRequest.types

  // Use ethers.js signTypedData method
  // Note: ethers v6 requires the signer to be connected to a provider
  const signature = await signer.signTypedData(domain, types, message)

  return signature
}

/**
 * Compute the hash of calldata for verification
 *
 * @param calldata - Raw calldata bytes (0x prefixed)
 * @returns keccak256 hash (0x prefixed)
 */
export function hashCalldata(calldata: string): string {
  return ethers.keccak256(calldata)
}

/**
 * Verify that a signature matches the expected signer
 *
 * @param signRequest - Calldata sign request
 * @param signature - Signature to verify
 * @param expectedSigner - Expected signer address
 * @returns True if signature is valid
 */
export function verifySignature(
  signRequest: CalldataSignRequest,
  signature: string,
  expectedSigner: string
): boolean {
  try {
    const domain = signRequest.domain
    const message = signRequest.message

    // Filter out EIP712Domain from types - ethers v6 handles it automatically
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { EIP712Domain, ...types } = signRequest.types

    const recoveredAddress = ethers.verifyTypedData(domain, types, message, signature)
    return recoveredAddress.toLowerCase() === expectedSigner.toLowerCase()
  } catch {
    return false
  }
}

/**
 * Build EIP-712 domain separator
 */
export function buildDomainSeparator(domain: EIP712Domain): string {
  return ethers.TypedDataEncoder.hashDomain(domain)
}

export type { CalldataSignRequest, EIP712Domain, EIP712Type }
