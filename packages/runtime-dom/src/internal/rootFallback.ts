import type { UnexpectedError } from "../types/UnexpectedError.ts";

/** The app root's default Boundary fallback (k.errors): the message in `<pre data-k-error="<at>">`. */
export function rootFallback(error: UnexpectedError): Node {
  const pre = document.createElement("pre");
  pre.setAttribute("data-k-error", error.data.at);
  pre.textContent = error.message;
  return pre;
}
