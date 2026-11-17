import type { KdfParametersV1 } from './types'
import { assertCryptoAvailable } from './web-crypto'
const MIN_ITERATIONS = 250_000
const MAX_ITERATIONS = 1_000_000
const decode = (value: string) => Uint8Array.from(atob(value), char => char.charCodeAt(0))
export const encodeSalt = (salt: Uint8Array) => btoa(String.fromCharCode(...salt))
export function validKdfParameters(value: unknown): value is KdfParametersV1 {
	if (typeof value !== 'object' || value === null) return false
	const parameters = value as Partial<KdfParametersV1>
	return parameters.version === 1 && parameters.algorithm === 'PBKDF2' && parameters.hash === 'SHA-256' && Number.isSafeInteger(parameters.iterations) && (parameters.iterations ?? 0) >= MIN_ITERATIONS && (parameters.iterations ?? Infinity) <= MAX_ITERATIONS && parameters.saltBytes === 16
}
export async function deriveKey(password: string, salt: string, parameters: KdfParametersV1): Promise<CryptoKey> {
	assertCryptoAvailable()
	if (!validKdfParameters(parameters)) throw new Error('Parâmetros de derivação de chave inválidos.')
	const saltBytes = decode(salt)
	if (saltBytes.length !== parameters.saltBytes || encodeSalt(saltBytes) !== salt) throw new Error('Salt inválido.')
	const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey'])
	return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: saltBytes as unknown as BufferSource, iterations: parameters.iterations, hash: parameters.hash }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}
