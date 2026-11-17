export interface LockChannel { postMessage(message: { type: 'lock' }): void; close(): void; onmessage: ((event: MessageEvent<{ type: 'lock' }>) => void) | null }
export class LockCoordinator { private readonly channel?: LockChannel; private readonly onRemoteLock: () => void
  constructor(onRemoteLock: () => void, factory: ((name: string) => LockChannel) | undefined = typeof BroadcastChannel === 'undefined' ? undefined : name => new BroadcastChannel(name)) { this.onRemoteLock = onRemoteLock; this.channel = factory?.('psicarol-lock-v1'); if (this.channel) this.channel.onmessage = event => { if (event.data?.type === 'lock') this.onRemoteLock() } }
  broadcastLock(): void { this.channel?.postMessage({ type: 'lock' }) }
  close(): void { this.channel?.close() }
}
