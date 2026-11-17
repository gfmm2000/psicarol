import { afterEach, expect, test, vi } from 'vitest'
import { AutoLockController } from './auto-lock-controller'

afterEach(() => vi.useRealTimers())

test('locks after the configured inactivity period', () => {
  vi.useFakeTimers()
  const lock = vi.fn()
  const controller = new AutoLockController(lock)

  controller.configure(2)
  vi.advanceTimersByTime(119_999)
  expect(lock).not.toHaveBeenCalled()
  vi.advanceTimersByTime(1)
  expect(lock).toHaveBeenCalledOnce()
  controller.stop()
})

test('restarts the inactivity period on activity and can be stopped', () => {
  vi.useFakeTimers()
  const lock = vi.fn()
  const controller = new AutoLockController(lock)

  controller.configure(1)
  vi.advanceTimersByTime(30_000)
  controller.touch()
  vi.advanceTimersByTime(30_000)
  expect(lock).not.toHaveBeenCalled()
  controller.stop()
  vi.advanceTimersByTime(60_000)
  expect(lock).not.toHaveBeenCalled()
})