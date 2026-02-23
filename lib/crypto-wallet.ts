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
// Base mainnet network definition — avoids auto-detection conflicts
const BASE_NETWORK = { chainId: 8453, name: 'base' }

// Multiple fallback RPCs in priority order
const BASE_RPCS = [
  'https://rpc.ankr.com/base',
  'https://base.llamarpc.com',
  process.env.BASE_RPC_URL || 'https://mainnet.base.org',
].filter(Boolean) as string[]

export function getBaseProvider(): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(BASE_RPCS[0], BASE_NETWORK, { staticNetwork: true })
}

export function getBaseFallbackProvider(): ethers.FallbackProvider {
  // Explicitly set network on each provider to avoid chain ID mismatch
  const providers = BASE_RPCS.map((rpc, i) => ({
    provider: new ethers.JsonRpcProvider(rpc, BASE_NETWORK, { staticNetwork: true }),
    priority: i + 1,
    stallTimeout: 3000,
  }))
  return new ethers.FallbackProvider(providers, 1)
}

/**
 * Parse raw USDC amount (6 decimals) to a human-readable float.
 */
export function parseUsdc(raw: bigint): number {
  return Number(raw) / Math.pow(10, USDC_DECIMALS)
}

/**
 * Fetch live USDC → GBP rate from CoinGecko (free, no API key).
 * Falls back to 0.79 if the request fails.
 */
export async function fetchUsdcGbpRate(): Promise<number> {
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=usd-coin&vs_currencies=gbp',
      { next: { revalidate: 0 } }
    )
    if (!res.ok) throw new Error(`CoinGecko ${res.status}`)
    const data = await res.json() as { 'usd-coin': { gbp: number } }
    const rate = data['usd-coin']?.gbp
    if (!rate || rate < 0.5 || rate > 1.5) throw new Error('Rate out of range')
    return rate
  } catch (err) {
    console.warn('[crypto] CoinGecko rate fetch failed, using fallback 0.79:', err)
    return 0.79
  }
}

/**
 * Convert USDC amount to GBP using a pre-fetched rate.
 */
export function usdcToGbp(usdcAmount: number, rate: number = 0.79): number {
  return parseFloat((usdcAmount * rate).toFixed(2))
}
