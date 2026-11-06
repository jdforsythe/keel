import type { KeelError } from "@keel/schema";

/** The root fallback when no `errorElement` in the chain applies: an alert naming the error code. */
export function defaultError(error: KeelError<string, unknown>): Node {
  const el = document.createElement("div");
  el.setAttribute("role", "alert");
  el.setAttribute("data-keel-error", error.code);
  el.textContent = error.message;
  return el;
}
