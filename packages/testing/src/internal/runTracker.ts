import { createHook } from "node:async_hooks";
import type { Piece } from "./Piece.ts";
import type { RunHandle } from "./RunHandle.ts";
import type { RunState } from "./RunState.ts";
import { runStorage } from "./runStorage.ts";

const active = new Set<RunState>();
const hook = createHook({
  init(id, type) {
    // A promise is never pending work (k.drive Driving): parked work is promises alone.
    if (type === "PROMISE") return;
    const scope = runStorage.getStore();
    if (scope !== undefined && !scope.state.stopped)
      scope.state.live.set(id, { label: type, since: performance.now() });
  },
  destroy(id) {
    for (const state of active) state.live.delete(id);
  },
});

/**
 * Track the work the code run through `inRun` makes, with an `async_hooks` hook that is on only while a tracker is:
 * the asynchronous resources (Node destroys one when it is done: a timer after its callback, a request after it
 * answers) and the held work. Each piece keeps the real time it was created at.
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
      state.live.set(id, { label, since: performance.now() });
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
    pending: () => [...state.live.values()],
    stop: () => {
      state.stopped = true;
      active.delete(state);
      state.live.clear();
      if (active.size === 0) hook.disable();
    },
  };
}
