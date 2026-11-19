import type { Ctx, FireEvent } from "@keel/ctx";

/** The input a browser counts as user activation (k.opening Link-started); a `keydown` of Escape is none. */
const INPUTS = ["pointerdown", "pointerup", "mousedown", "touchend", "keydown"] as const;
/**
 * What a shell's ctx holds in memory, never stored: `acted`, whether a person has acted since the ctx started;
 * `linked`, whether it is link-started (a delivered return link was taken since the last act).
 */
type Acts = { acted: boolean; linked: boolean };
const states = new WeakMap<Ctx, Acts>();
/** The ctxs whose window listeners are attached. */
const watched = new WeakSet<Ctx>();

/** Whether `e` is a person's act: trusted (`isTrusted`), and not the Escape key. */
const isAct = (e: Event): boolean =>
  e.isTrusted === true && !(e.type === "keydown" && "key" in e && e.key === "Escape");

/** Records an act on `ctx`: it has acted and is no longer link-started. */
const mark = (ctx: Ctx): void => {
  const s = personActs.of(ctx);
  s.acted = true;
  s.linked = false;
};

/**
 * A person's acts in a shell's ctx (k.opening Link-started), per ctx in memory only, so a new ctx starts with none.
 * `watch` attaches, once per ctx, capture-phase listeners on the window for the activation input, which run before any
 * handler the page's code adds; an event the page's code dispatches, `click()` and `requestSubmit()` are untrusted or
 * no such input, and with no window there is no listener and no act. `fired` is a test harness's `fire` of `e`
 * (k.opening Testing), whose events are untrusted: a `click`, a `submit` or a `keydown` other than Escape stands for a
 * person's input and marks an act, any other is none.
 * `of` is the ctx's state, which the intake marks link-started when it takes a link.
 */
export const personActs = {
  watch(ctx: Ctx): void {
    if (watched.has(ctx) || typeof window === "undefined") return;
    watched.add(ctx);
    const on = (e: Event): void => {
      if (isAct(e)) mark(ctx);
    };
    for (const type of INPUTS) window.addEventListener(type, on, { capture: true });
  },
  fired(ctx: Ctx, e: FireEvent): void {
    if (e.type === "click" || e.type === "submit" || (e.type === "keydown" && e.key !== "Escape")) mark(ctx);
  },
  of(ctx: Ctx): Acts {
    const s = states.get(ctx) ?? { acted: false, linked: false };
    states.set(ctx, s);
    return s;
  },
};
