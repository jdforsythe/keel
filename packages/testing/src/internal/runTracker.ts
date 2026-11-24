import { AsyncLocalStorage, createHook } from "node:async_hooks";

/** The async context a piece of code runs in: the run it belongs to, and the held work it is inside, if any. */
interface Scope {
  readonly state: State;
  readonly held: string | undefined;
}

interface State {
  /** Pending asynchronous resources made in the run's context other than promises: Node's id, its type. */
  readonly live: Map<number, string>;
  /** Called with the label of held work that made a clock wait. */
  readonly onHeldWait: (label: string) => void;
}

const storage = new AsyncLocalStorage<Scope>();
const active = new Set<State>();
const hook = createHook({
  init(id, type) {
    // A promise is never pending work (k.drive Driving): parked work is promises alone.
    if (type === "PROMISE") return;
    const scope = storage.getStore();
    if (scope !== undefined) scope.state.live.set(id, type);
  },
  destroy(id) {
    for (const state of active) state.live.delete(id);
  },
});

/** The run's async context (k.drive Driving), Node only. */
export interface RunTracker {
  /** Call `fn` inside the run's context: its resources are the run's. */
  readonly inRun: <T>(fn: () => T) => T;
  /** Call `start` inside the run's context, as the work held under `label`. */
  readonly enter: <T>(label: string, start: () => Promise<T>) => Promise<T>;
  /** Report that code made a clock wait: held work that did is `onHeldWait`'s. */
  readonly waited: () => void;
  /** The Node types of the resources of the run that are still pending, in creation order. */
  readonly pending: () => readonly string[];
  /** End the tracking. */
  readonly stop: () => void;
}

/** Call `fn` outside every run's context (the drive's and the harness's own macrotask turns are not work). */
export const outside = <T>(fn: () => T): T => storage.exit(fn);

/**
 * Track the asynchronous resources the code run through `inRun` makes, with an `async_hooks` hook that is on only
 * while a tracker is. Node destroys a resource when it is done: a timer after its callback, a request after it answers.
 */
export function runTracker(onHeldWait: (label: string) => void): RunTracker {
  const state: State = { live: new Map(), onHeldWait };
  if (active.size === 0) hook.enable();
  active.add(state);
  return {
    inRun: (fn) => storage.run({ state, held: undefined }, fn),
    enter: (label, start) => storage.run({ state, held: label }, start),
    waited: () => {
      const scope = storage.getStore();
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
