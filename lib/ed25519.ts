// Ed25519 signature verification for signed posts (PRD §6.7 acceptance).
// node:crypto has native Ed25519 support — no dependency needed. Raw 32-byte
// public keys aren't directly importable, so we wrap them in the fixed SPKI
// DER prefix for Ed25519 (RFC 8410) before handing them to crypto.createPublicKey.

import { createPublicKey, verify } from 'node:crypto'

const SPKI_ED25519_PREFIX = Buffer.from('302a300506032b6570032100', 'hex')

/** True if `s` is exactly `bytes * 2` hex characters. */
export function isHexKey(s: string, bytes: number): boolean {
  return typeof s === 'string' && s.length === bytes * 2 && /^[0-9a-fA-F]+$/.test(s)
}

/**
 * Verify an Ed25519 signature over a UTF-8 message.
 * publicKeyHex: 64 hex chars (32-byte raw public key). signatureHex: 128 hex chars (64-byte signature).
 * Returns false on ANY malformed input or failed verification — never throws.
 */
export function verifyEd25519(publicKeyHex: string, message: string, signatureHex: string): boolean {
  try {
    if (!isHexKey(publicKeyHex, 32) || !isHexKey(signatureHex, 64)) return false

    const rawKey = Buffer.from(publicKeyHex, 'hex')
    const der = Buffer.concat([SPKI_ED25519_PREFIX, rawKey])
    const keyObject = createPublicKey({ key: der, format: 'der', type: 'spki' })
    const signature = Buffer.from(signatureHex, 'hex')

    return verify(null, Buffer.from(message, 'utf8'), keyObject, signature)
  } catch {
    return false
  }
}
