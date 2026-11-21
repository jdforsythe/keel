import { quietDepth as depth } from "./quietDepth.ts";

/**
 * Run `fn` with `fire` reports muted: the router's focus after a navigation and forms' focus on an invalid field
 * dispatch `focus`/`blur` that no user caused, and a replay must not apply them (rfc:0070).
 */
export function quiet<T>(fn: () => T): T {
  depth.n++;
  try {
    return fn();
  } finally {
    depth.n--;
  }
}
