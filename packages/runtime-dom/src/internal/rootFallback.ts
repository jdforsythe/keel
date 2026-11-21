import type { CaughtError } from "../types/CaughtError.ts";

/**
 * The app root's default Boundary fallback (k.errors): `<pre data-k-error="<at>">` holding the code
 * `keel.unexpected`, or with `mode: "dev"` the error's message.
 */
export function rootFallback(error: CaughtError, mode: "dev" | "production" = "production"): Node {
  const pre = document.createElement("pre");
  pre.setAttribute("data-k-error", error.data.at);
  pre.textContent = mode === "dev" ? error.message : error.code;
  return pre;
}
