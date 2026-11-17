export interface KdfParametersV1 { version: 1; algorithm: 'PBKDF2'; hash: 'SHA-256'; iterations: number; saltBytes: number }
export interface EncryptedPayloadV1 { cryptoVersion: 1; iv: string; ciphertext: string }
export interface CryptoMetadata { id: 'crypto'; cryptoVersion: 1; activeGeneration: number; kdf: KdfParametersV1; salt: string; verifier: EncryptedPayloadV1 }
export const KDF_V1: KdfParametersV1 = { version: 1, algorithm: 'PBKDF2', hash: 'SHA-256', iterations: 500_000, saltBytes: 16 }
