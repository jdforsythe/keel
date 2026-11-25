import { createHook } from "node:async_hooks";
import type { Hold } from "./Hold.ts";
import type { Piece } from "./Piece.ts";
import type { RunHandle } from "./RunHandle.ts";
import type { RunState } from "./RunState.ts";
import { fullCollection } from "./fullCollection.ts";
import { onThreadPool } from "./onThreadPool.ts";
import { runStorage } from "./runStorage.ts";

const active = new Set<RunState>();
const hook = createHook({
  init(id, type, _trigger, resource) {
    // A promise is never pending work (k.drive Driving): parked work is promises alone.
    if (type === "PROMISE") return;
    const scope = runStorage.getStore();
    // A resource made in held work's async context is the hold's, not work of the run.
    if (scope === undefined || scope.held !== undefined || scope.state.stopped) return;
    scope.state.live.set(id, { label: type, resource: new WeakRef(resource) });
    scope.state.moved = true;
  },
  after(id) {
    // A callback of a pending resource ran: it may be done and wait only for a collection (an async gzip's handle).
    for (const state of active) if (state.live.has(id)) state.moved = true;
  },
  destroy(id) {
    for (const state of active) state.live.delete(id);
  },
});

/**
 * Track the work the code run through `inRun` makes, with an `async_hooks` hook that is on only while a tracker is:
 * the asynchronous resources made outside held work (Node destroys one when it is done: a timer after its callback, a
 * request after it answers, a synchronous call's job at a garbage collection) and the held work, pending until the
 * drive delivers it.
 */
export function runTracker(onHeldWait: (label: string) => void): RunHandle {
  const state: RunState = { live: new Map(), holds: [], onHeldWait, stopped: false, moved: false };
  let holds = 0;
  if (active.size === 0) hook.enable();
  active.add(state);
  /** The resources pending when last read. */
  let last = "";
  const pending = (): readonly Piece[] => {
    // Keys only before the collection: reading a weak reference keeps its target alive until the turn ends.
    const ids = [...state.live.keys()].filter((id) => id >= 0);
    const seen = ids.join(",");
    // The same set on two reads in a row, and since the last collection a resource joined it or a callback of one
    // ran: what is left may be a job only a collection destroys. Work in flight is reachable and survives it.
    if (seen === last && ids.length > 0 && state.moved) {
      state.moved = false;
      fullCollection();
    }
    last = seen;
    for (const [id, piece] of state.live)
      if (piece.resource !== undefined && piece.resource.deref() === undefined) state.live.delete(id);
    return [...state.live.values()];
  };
  return {
    inRun: (fn) => runStorage.run({ state, held: undefined }, fn),
    enter: <T>(label: string, start: () => Promise<T>): Promise<T> => {
      holds += 1;
      const hold: Hold = { id: -holds, deliver: undefined };
      state.live.set(hold.id, { label });
      state.holds.push(hold);
      return new Promise<T>((resolve, reject) => {
        let work: Promise<T>;
        try {
          work = runStorage.run({ state, held: label }, start);
        } catch (e) {
          work = Promise.reject(e);
        }
        const settled = (deliver: () => void): void => {
          // Once the run is over nothing delivers: the outcome goes straight to whoever still awaits it.
          if (state.stopped) deliver();
          else hold.deliver = deliver;
        };
        work.then(
          (value) => settled(() => resolve(value)),
          (e: unknown) => settled(() => reject(e)),
        );
      });
    },
    waited: () => {
      const scope = runStorage.getStore();
      if (scope?.state === state && scope.held !== undefined) state.onHeldWait(scope.held);
    },
    pending,
    deliver: (now) => {
      const first = state.holds[0];
      if (first?.deliver === undefined) return false;
      if (now.some((piece) => piece.resource !== undefined && onThreadPool(piece.label))) return false;
      state.holds.shift();
      state.live.delete(first.id);
      first.deliver();
      return true;
    },
    stop: () => {
      state.stopped = true;
      active.delete(state);
      state.live.clear();
      for (const hold of state.holds.splice(0)) hold.deliver?.();
      if (active.size === 0) hook.disable();
    },
  };
}
