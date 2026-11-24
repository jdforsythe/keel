import { createHook } from "node:async_hooks";
import type { Piece } from "./Piece.ts";
import type { RunHandle } from "./RunHandle.ts";
import type { RunState } from "./RunState.ts";
import { runStorage } from "./runStorage.ts";

const active = new Set<RunState>();
/**
 * False for a crypto job made by a synchronous call (`randomBytes(n)` with no callback): Node destroys it only at a
 * garbage collection, so it is no pending work. A request has its `ondone` set by then.
 */
const requested = (piece: Piece): boolean => {
  const job = piece.job?.deref();
  return piece.job === undefined || (job !== undefined && typeof Reflect.get(job, "ondone") === "function");
};
const hook = createHook({
  init(id, type, _trigger, resource) {
    // A promise is never pending work (k.drive Driving): parked work is promises alone.
    if (type === "PROMISE") return;
    const scope = runStorage.getStore();
    if (scope !== undefined && !scope.state.stopped)
      scope.state.live.set(
        id,
        resource.constructor.name.endsWith("Job") ? { label: type, job: new WeakRef(resource) } : { label: type },
      );
  },
  destroy(id) {
    for (const state of active) state.live.delete(id);
  },
});

/**
 * Track the work the code run through `inRun` makes, with an `async_hooks` hook that is on only while a tracker is:
 * the asynchronous resources (Node destroys one when it is done: a timer after its callback, a request after it
 * answers) and the held work.
 */
export function runTracker(onHeldWait: (label: string) => void): RunHandle {
  const state: RunState = { live: new Map(), onHeldWait, stopped: false };
  let holds = 0;
  if (active.size === 0) hook.enable();
  active.add(state);
  return {
    inRun: (fn) => runStorage.run({ state, held: undefined }, fn),
    enter: (label, start) => {
      holds += 1;
      const id = -holds;
      state.live.set(id, { label });
      const release = (): void => void state.live.delete(id);
      let work: ReturnType<typeof start>;
      try {
        work = runStorage.run({ state, held: label }, start);
      } catch (e) {
        release();
        throw e;
      }
      work.then(release, release);
      return work;
    },
    waited: () => {
      const scope = runStorage.getStore();
      if (scope?.state === state && scope.held !== undefined) state.onHeldWait(scope.held);
    },
    pending: () => [...state.live.values()].filter(requested),
    stop: () => {
      state.stopped = true;
      active.delete(state);
      state.live.clear();
      if (active.size === 0) hook.disable();
    },
  };
}
