import type { Ctx } from "@keel/ctx";
import { observed, report } from "@keel/ctx/internal";
import type { Root } from "./Root.ts";
import { SECRET_FIELDS } from "./SECRET_FIELDS.ts";
import { dispatch } from "./dispatch.ts";
import { fireOf } from "./fireOf.ts";
import { idOf } from "./idOf.ts";
import { secretsOf } from "./secretsOf.ts";

/** The input events reported to ctx observers (k.ctx Observers). */
const FIRE = ["click", "input", "change", "keydown", "submit", "focus", "blur"];
/** Events already reported (nested roots on one ctx see the same event). */
const told = new WeakSet<Event>();

/**
 * A delegation root on `el` (or detached until `attach`): at most one listener per event type. With a `ctx`, capture
 * listeners report each input event on an element with an id to its observers before any handler runs (rfc:0070);
 * nothing is built while nothing observes. A field that was ever a password field (type or autocomplete) under
 * this ctx is reported masked from then on, also after a show-password toggle (red-team 0207).
 */
export function createRoot(el: Element | null, ctx?: Ctx): Root {
  let target = el;
  const types = new Map<string, (e: Event) => void>();
  const tap = (e: Event): void => {
    if (!observed(ctx) || told.has(e)) return;
    told.add(e);
    const id = idOf(e.target instanceof Node ? e.target : null);
    // Every password field rendered so far, and the target if it is one, stays secret for the rest of the ctx.
    const secret = secretsOf(ctx);
    for (const f of target?.querySelectorAll(SECRET_FIELDS) ?? []) secret.add(idOf(f));
    if (e.target instanceof Element && e.target.matches(SECRET_FIELDS)) secret.add(id);
    const event = fireOf(e, e.target, secret.has(id));
    if (id !== "" && event !== undefined) report(ctx, { kind: "fire", id, event });
  };
  const taps = ctx === undefined ? [] : FIRE;
  for (const t of taps) target?.addEventListener(t, tap, true);
  return {
    ctx,
    listen(type) {
      if (types.has(type)) return;
      const l = (e: Event): void => {
        if (target !== null && e.target instanceof Node) dispatch(target, e, e.target);
      };
      types.set(type, l);
      target?.addEventListener(type, l);
    },
    attach(next) {
      for (const [t, l] of types) {
        target?.removeEventListener(t, l);
        next.addEventListener(t, l);
      }
      for (const t of taps) {
        target?.removeEventListener(t, tap, true);
        next.addEventListener(t, tap, true);
      }
      target = next;
    },
    dispose() {
      for (const [t, l] of types) target?.removeEventListener(t, l);
      for (const t of taps) target?.removeEventListener(t, tap, true);
      types.clear();
    },
  };
}
