import { ethers } from 'ethers'

// BIP-44 derivation path for EVM (ETH/Base)
const DERIVATION_BASE = "m/44'/60'/0'/0"

// USDC has 6 decimal places
const USDC_DECIMALS = 6

// Minimal ERC-20 ABI for Transfer events + balanceOf
export const ERC20_ABI = [
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
]

/**
 * Derive the deposit address for a given index.
 * The index maps to a user's assigned address slot.
 */
export function deriveAddress(index: number): string {
  const mnemonic = process.env.CRYPTO_HD_MNEMONIC
  if (!mnemonic) throw new Error('CRYPTO_HD_MNEMONIC not set')

  // ethers v6: pass the full derivation path into fromMnemonic directly
  const mn = ethers.Mnemonic.fromPhrase(mnemonic)
  const wallet = ethers.HDNodeWallet.fromMnemonic(mn, `${DERIVATION_BASE}/${index}`)
  return wallet.address
}

/**
 * Get a Base mainnet provider.
 */
export function getBaseProvider(): ethers.JsonRpcProvider {
  const rpc = process.env.BASE_RPC_URL || 'https://mainnet.base.org'
  return new ethers.JsonRpcProvider(rpc)
}

/**
 * Parse raw USDC amount (6 decimals) to a human-readable float.
 */
export function parseUsdc(raw: bigint): number {
  return Number(raw) / Math.pow(10, USDC_DECIMALS)
}

/**
 * Convert USDC amount to GBP.
 * For now: 1 USDC ≈ 1 USD ≈ 0.79 GBP (approximate, update periodically).
 * TODO: Fetch live rate from a price feed.
 */
export function usdcToGbp(usdcAmount: number): number {
  const USDC_TO_GBP = 0.79
  return parseFloat((usdcAmount * USDC_TO_GBP).toFixed(2))
}
