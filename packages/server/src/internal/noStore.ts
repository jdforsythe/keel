import type { Handled } from "./Handled.ts";

/** `h` with `cache-control: no-store` on its response (action results must never be served from a cache). */
export function noStore(h: Handled): Handled {
  h.response.headers.set("cache-control", "no-store");
  return h;
}
