import { report } from "@keel/ctx/internal";
import type { Held } from "../internal/Held.ts";
import { eventQueue } from "../internal/eventQueue.ts";
import { heldChildren } from "../internal/heldChildren.ts";
import { islandProps } from "../internal/islandProps.ts";
import { readState } from "../internal/readState.ts";
import { resumeIsland } from "../internal/resumeIsland.ts";
import type { Island } from "../types/Island.ts";
import type { ResumeOptions } from "../types/ResumeOptions.ts";

/** Where the snapshots no store in `stores` took wait while islands resume; `@keel/store` reads it at creation. */
const WAITING = Symbol.for("keel.waitingSnapshots");
/** What `@keel/store` leaves in place of a waiting snapshot the store's schema refuses. */
const REFUSED = Symbol.for("keel.refusedSnapshot");
/** Where `resume` leaves its warnings when it rethrows an island's throw, for the resume entry to print. */
const THROWN_WARNINGS = Symbol.for("keel.resumeWarnings");

/** Whether `result`, what a store's `restore` returned, is a refusal (`{ ok: false }`). */
const refused = (result: unknown): boolean =>
  typeof result === "object" && result !== null && Reflect.get(result, "ok") === false;
const unrestored = (id: string): string => `E1253 #k-state snapshot for store "${id}" does not restore`;

// The package's one import-time effect: queue events fired before resume (see README).
eventQueue.install();

/**
 * Resume server-rendered islands under `root` (generated entry only, ADR-0006): restore `options.stores`
 * from `#k-state` (a snapshot with no store there restores the store of its id an island creates while it resumes,
 * else is an E1253 warning, as is a snapshot the store refuses), report its served `route` to `options.ctx`'s observers as a `nav`, then its failed loader's `error`
 * (`code` and `data.at` only), pass `options.ctx` (k.ctx) to every island root, then for each `[data-k-island]` in
 * document order (an ancestor before its descendants; k.resume) attach its bindings and delegated handlers to the
 * existing nodes without re-rendering; once every island has resumed, replay the events queued before resume in the
 * order they fired, each through every enclosing island as a live one (k.resume Replay). Each island has its own props, root
 * Boundary and delegation root, and a `children` that returns the server's content of its child level
 * (`heldChildren`); its claim stops at that content. The root Boundary's fallback shows the message only with
 * `options.mode` `"dev"`. Returns dev warnings (E1253: that island alone was re-rendered on the client). An island
 * whose resume throws past its root Boundary is rethrown once the others resumed and the queue replayed; the warnings
 * collected are then at `Symbol.for("keel.resumeWarnings")` on `globalThis`.
 */
export function resume(
  root: Element,
  components: Readonly<Record<string, Island>>,
  options: ResumeOptions = {},
): { warnings: string[] } {
  const stores = options.stores ?? {};
  const warnings: string[] = [];
  const state = readState(root, warnings);
  // A snapshot with no store in `stores` waits for an island to create its store while it resumes (k.resume Stores).
  const waiting = new Map<string, unknown>();
  for (const [id, snapshot] of Object.entries(state.stores)) {
    const store = Object.hasOwn(stores, id) ? stores[id] : undefined;
    if (store === undefined) waiting.set(id, snapshot);
    else if (refused(store.restore(snapshot))) warnings.push(unrestored(id));
  }
  // The served route is the ctx's first navigation (k.ctx Observers, rfc:0071): no router runs on an island page.
  const route = state.route;
  if (route !== null) {
    const { href, ...rest } = route;
    report(options.ctx, { kind: "nav", href, route: { ...rest, schemas: {} } });
  }
  // The served page's failed loader ran on the server: report it here, after its route, so the ctx keeps it.
  if (state.error !== null) report(options.ctx, { kind: "error", error: state.error });
  const all = [...(root.matches("[data-k-island]") ? [root] : []), ...root.querySelectorAll("[data-k-island]")];
  let thrown: { error: unknown } | null = null;
  const before: unknown = Reflect.get(globalThis, WAITING);
  Reflect.set(globalThis, WAITING, waiting);
  try {
    for (const el of all) {
      const id = el.getAttribute("data-k-island") ?? "";
      const component = Object.hasOwn(components, id) ? components[id] : undefined;
      if (component === undefined) {
        warnings.push(`E1253 [data-k-island="${id}"] has no compiled component; left static`);
        eventQueue.resume(el, null);
        continue;
      }
      const held: Held = { nodes: null, calls: -1 };
      try {
        const w = resumeIsland(
          el,
          id,
          component,
          { ...islandProps(component, state.islands[id], id, warnings), children: heldChildren(held) },
          held,
          options.ctx,
          options.mode,
          waiting,
        );
        if (w !== null) warnings.push(w);
      } catch (error) {
        thrown ??= { error };
      }
    }
  } finally {
    Reflect.set(globalThis, WAITING, before);
  }
  for (const [id, left] of waiting)
    warnings.push(left === REFUSED ? unrestored(id) : `E1253 #k-state has a snapshot for unknown store "${id}"`);
  eventQueue.replay();
  if (thrown !== null) {
    Reflect.set(globalThis, THROWN_WARNINGS, warnings);
    throw thrown.error;
  }
  return { warnings };
}
