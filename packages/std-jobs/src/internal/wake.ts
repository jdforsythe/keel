import type { Chan } from "./Chan.ts";

/** Tell the runners of `c` the queue changed. */
export function wake(c: Chan): void {
  c.v++;
  for (const w of c.wake) w();
}
