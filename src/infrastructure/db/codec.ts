export interface RecordContext { table: string; id: string }
export interface RecordCodec { encode(value: unknown, context: RecordContext): Promise<string>; decode<T>(payload: string, context: RecordContext): Promise<T> }
export class LockedError extends Error { constructor() { super('A aplicação está bloqueada.'); this.name = 'LockedError' } }
