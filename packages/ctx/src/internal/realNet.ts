import type { Net } from "../Net.ts";

/** Platform fetch, resolved at call time (k.ctx). */
export function realNet(): Net {
  return { fetch: (req) => fetch(req) };
}
