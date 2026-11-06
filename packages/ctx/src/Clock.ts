/** Wall-clock capability. `now()` returns milliseconds. */
export interface Clock {
  now(): number;
}
