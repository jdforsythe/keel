/**
 * What a `csp` record says was blocked (k.security Reports): `inline`, `eval` (`wasm-eval` too), `trusted-types` (any
 * `trusted-types-*` value), else the blocked URL's origin (at most 64 characters); `-` when it is none of these. Never a path, query or sample.
 */
export function blockedOf(raw: string): string {
  if (raw === "inline" || raw === "eval") return raw;
  if (raw === "wasm-eval") return "eval";
  if (raw.startsWith("trusted-types")) return "trusted-types";
  try {
    return new URL(raw).origin.slice(0, 64);
  } catch {
    return "-";
  }
}
