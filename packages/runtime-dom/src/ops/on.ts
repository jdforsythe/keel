import type { Handler } from "../internal/Handler.ts";
import { NON_BUBBLING } from "../internal/NON_BUBBLING.ts";
import { current } from "../internal/current.ts";
import { cx } from "../internal/cx.ts";
import { findById } from "../internal/findById.ts";
import { guard } from "../internal/guard.ts";
import { handlers } from "../internal/handlers.ts";

/**
 * Register `handler` for `type` on the element with id `id` in the current render. Bubbling types go
 * into the delegated table (one root listener per type); non-bubbling types bind on the element.
 * Disposing the owning scope removes the registration. Throws and rejections go to the nearest Boundary.
 */
export function on(id: string, type: string, handler: (event: Event) => unknown): void {
  const owner = current("on");
  const el = findById(cx.nodes, id);
  if (el === null) throw new Error(`k.runtime: on(${JSON.stringify(id)}) found no element with that id in this render`);
  if (NON_BUBBLING.has(type)) {
    const l = (e: Event): void => {
      if (!owner.gone) guard(owner, id, () => handler(e));
    };
    el.addEventListener(type, l);
    owner.cleanups.push(() => el.removeEventListener(type, l));
    return;
  }
  const entry: Handler = { fn: handler, owner, at: id };
  const table = handlers.get(el) ?? new Map<string, Handler>();
  table.set(type, entry);
  handlers.set(el, table);
  owner.root.listen(type);
  owner.cleanups.push(() => {
    if (table.get(type) === entry) table.delete(type);
  });
}
