import type { Saved } from "./Saved.ts";

/** The in-process copy of stored snapshot text `raw` (`null`: absent), parsed once here (RFC 0054). */
export function savedOf(raw: string | null): Saved {
  const json: unknown = raw === null ? null : JSON.parse(raw);
  return { raw, json };
}
