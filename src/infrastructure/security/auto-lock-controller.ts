export class AutoLockController { private timer?: ReturnType<typeof setTimeout>; private readonly lock: () => void; private minutes = 10
  constructor(lock: () => void) { this.lock = lock }
  configure(minutes: number): void { this.minutes = minutes; this.touch() }
  touch(): void { if (this.timer) clearTimeout(this.timer); this.timer = setTimeout(this.lock, this.minutes * 60_000) }
  stop(): void { if (this.timer) clearTimeout(this.timer); this.timer = undefined }
}
