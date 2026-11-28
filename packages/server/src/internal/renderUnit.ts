import type { Ctx } from "@keel/ctx";
import { mount } from "@keel/runtime-dom";
import { made, serverMode } from "@keel/runtime-dom/internal";

/**
 * Run one route component as a render unit (k.runtime): compiled ops (`text`, `on`, `cond`, ...) need a mount
 * or resume context, so the call runs inside a `mount` on a detached host, whose root Boundary reports binding
 * errors through `onError`, on `ctx`. The component's return value (a Node, a string, anything) is returned untouched
 * and never inserted. Called in the request scope, the mount's scope is a child of it: stores the component
 * creates stay live for `#k-state`, and everything is disposed with the request. Units never nest (the caller
 * renders child levels first). A throw from the component or a binding is rethrown as itself. The
 * runtime renders in its server mode, writing the regions `resume` claims (k.resume Regions), and checks that each
 * element its ops place was made after the op started: `seen.eager` is set when one was not (E1257, k.claim Server);
 * `seen.nothing` is set when a text binding rendered nothing (E1406, k.place).
 */
export function renderUnit(
  fn: () => unknown,
  ctx: Ctx,
  seen: { eager: boolean; nothing: boolean } = { eager: false, nothing: false },
): unknown {
  const host = document.createElement("div");
  const out: { value: unknown; error: { e: unknown } | null } = { value: undefined, error: null };
  serverMode.on = true;
  serverMode.nothing = false;
  made.on = true;
  made.from = made.seq;
  made.eager = false;
  try {
    mount(
      () => {
        // The thrown value is kept as itself, so its log records read its class, code and causes (k.serverlog).
        try {
          out.value = fn();
        } catch (e) {
          out.error = { e };
        }
        return host.ownerDocument.createComment("");
      },
      host,
      {
        ctx,
        onError: (e) => {
          out.error ??= { e };
        },
      },
    );
  } finally {
    serverMode.on = false;
    made.on = false;
    if (made.eager) seen.eager = true;
    if (serverMode.nothing) seen.nothing = true;
  }
  if (out.error !== null) throw out.error.e;
  return out.value;
}
