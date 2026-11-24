import { createHook } from "node:async_hooks";
import type { RunHandle } from "./RunHandle.ts";
import type { RunState } from "./RunState.ts";
import { runStorage } from "./runStorage.ts";

const active = new Set<RunState>();
const hook = createHook({
  init(id, type) {
    // A promise is never pending work (k.drive Driving): parked work is promises alone.
    if (type === "PROMISE") return;
    const scope = runStorage.getStore();
    if (scope !== undefined) scope.state.live.set(id, type);
  },
  destroy(id) {
    for (const state of active) state.live.delete(id);
  },
});

/**
 * Track the asynchronous resources the code run through `inRun` makes, with an `async_hooks` hook that is on only
 * while a tracker is. Node destroys a resource when it is done: a timer after its callback, a request after it answers.
 */
export function runTracker(onHeldWait: (label: string) => void): RunHandle {
  const state: RunState = { live: new Map(), onHeldWait };
  if (active.size === 0) hook.enable();
  active.add(state);
  return {
    inRun: (fn) => runStorage.run({ state, held: undefined }, fn),
    enter: (label, start) => runStorage.run({ state, held: label }, start),
    waited: () => {
      const scope = runStorage.getStore();
      if (scope?.state === state && scope.held !== undefined) state.onHeldWait(scope.held);
    },
    pending: () => [...state.live.values()],
    stop: () => {
      active.delete(state);
      state.live.clear();
      if (active.size === 0) hook.disable();
    },
  };
}
