import { plainWalk } from "./plainWalk.ts";

/** True when `x` is plain data (k.schema Plain data): what `s.json()` accepts. */
export function isJson(x: unknown): boolean {
  let plain = true;
  plainWalk(x, () => {
    plain = false;
    return false;
  });
  return plain;
}
