import { mount } from "@keel/runtime-dom";
import { attempted } from "./attempted.ts";

/**
 * Run one route component as a render unit (k.runtime): compiled ops (`text`, `on`, `cond`, ...) need a mount
 * or resume context, so the call runs inside a `mount` on a detached host, whose root Boundary reports binding
 * errors through `onError`. The component's return value (a Node, a string, anything) is returned untouched
 * and never inserted. Called in the request scope, the mount's scope is a child of it: stores the component
 * creates stay live for `#k-state`, and everything is disposed with the request. Units never nest (the caller
 * renders child levels first). A throw from the component or a binding is rethrown as `keel.unexpected`.
 */
export function renderUnit(fn: () => unknown): unknown {
  const host = document.createElement("div");
  const out: { value: unknown; error: { e: unknown } | null } = { value: undefined, error: null };
  mount(
    () => {
      const r = attempted(fn);
      if (r.ok) out.value = r.value;
      else out.error = { e: r.error };
      return host.ownerDocument.createComment("");
    },
    host,
    {
      onError: (e) => {
        out.error ??= { e };
      },
    },
  );
  if (out.error !== null) throw out.error.e;
  return out.value;
}
