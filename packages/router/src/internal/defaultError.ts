import type { KeelError } from "@keel/schema";

/** The root fallback when no `errorElement` in the chain applies: an alert with the error's message, or for `keel.notFound` the heading `Not found` (as the server renders it). */
export function defaultError(error: KeelError<string, unknown>): Node {
  const el = document.createElement("div");
  el.setAttribute("role", "alert");
  el.setAttribute("data-keel-error", error.code);
  if (error.code === "keel.notFound")
    el.append(Object.assign(document.createElement("h1"), { textContent: "Not found" }));
  else el.textContent = error.message;
  return el;
}
