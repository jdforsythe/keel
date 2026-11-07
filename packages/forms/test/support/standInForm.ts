import { formHandle } from "@keel/router/internal";
// Test-only stand-in for @keel/router's <Form form>: the seam flow k.forms specifies (validate, setPending,
// onResult, error slot from the Result). Isolates forms tests from router internals; conformance uses the real Form.
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
    const r = f[formHandle].validate();
    if (!r.ok) return;
    f[formHandle].setPending(true);
    slot.textContent = "";
    void Promise.resolve(send(r.value)).then((out) => {
      f[formHandle].setPending(false);
      f[formHandle].onResult(out);
      if (!out.ok && out.error.code !== "keel.fields") slot.textContent = out.error.message;
    });
  });
  return el;
}
