// Test-only stand-in for @keel/router's <Form form>: the seam flow k.forms specifies (validate, pending, onResult,
// error slot). Used until the router lands; the conformance suite exercises the real Form.
import { effect } from "@keel/reactive";
import type { KeelError, Result } from "@keel/schema";
import type { FormState } from "../../src/index.ts";

export type Reply = Result<unknown, KeelError<string, unknown>>;

export function standInForm<T>(
  f: FormState<T>,
  send: (value: T) => Promise<Reply> | Reply,
  children: readonly Node[],
): HTMLFormElement {
  const el = document.createElement("form");
  const slot = document.createElement("div");
  slot.setAttribute("data-slot", "error");
  el.append(...children, slot);
  el.addEventListener("submit", (e) => {
    e.preventDefault();
    const r = f.validate();
    if (!r.ok) return;
    f.pending.set(true);
    void Promise.resolve(send(r.value)).then((out) => f.onResult(out));
  });
  effect(() => {
    slot.textContent = f.error()?.message ?? "";
  });
  return el;
}
