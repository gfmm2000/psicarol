import type { KdfParametersV1 } from './types'
import { assertCryptoAvailable } from './web-crypto'
const decode = (value: string) => Uint8Array.from(atob(value), char => char.charCodeAt(0))
export const encodeSalt = (salt: Uint8Array) => btoa(String.fromCharCode(...salt))
export async function deriveKey(password: string, salt: string, parameters: KdfParametersV1): Promise<CryptoKey> { assertCryptoAvailable(); const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']); return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: decode(salt), iterations: parameters.iterations, hash: parameters.hash }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']) }
