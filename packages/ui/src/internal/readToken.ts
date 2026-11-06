import { isReadable } from "./isReadable.ts";

/** The token name a style value holds now; reading a signal here registers it as a dependency. */
export function readToken(v: unknown): string | undefined {
  const x = isReadable(v) ? v.get() : v;
  if (typeof x === "string") return x;
  if (typeof x === "number") return String(x);
  return undefined;
}
