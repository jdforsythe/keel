/** Wall-clock capability. `now()` returns milliseconds. */
export interface Clock {
  now(): number;
  /**
   * Resolves after `ms` (finite, >= 0). Under sim it resolves when `advance` crosses the deadline. If `signal`
   * aborts first the promise rejects with `signal.reason`.
   */
  after(ms: number, signal?: AbortSignal): Promise<void>;
}
