import { State } from "./internal/State.ts";
import { fail } from "./internal/fail.ts";
import { flush } from "./internal/flush.ts";
import { mark } from "./internal/mark.ts";
import { rt } from "./internal/rt.ts";
import { track } from "./internal/track.ts";
import { watch } from "./internal/watch.ts";
import type { Resource } from "./types/Resource.ts";
import type { ResourceState } from "./types/ResourceState.ts";

const attempt = (fn: () => void): { error: unknown } | null => {
  try {
    fn();
    return null;
  } catch (error) {
    return { error };
  }
};

/**
 * Async value. `fetcher` runs at creation, on `refetch()`, and when a signal it read synchronously
 * changes. Every run gets a higher request id; only the latest request may settle the state.
 * `refetch()` is a write: inside an effect it must be declared in `writes` (E1201).
 */
export function resource<T>(fetcher: () => Promise<T>): Resource<T> {
  let current: ResourceState<T> = { state: "loading" };
  let latest = 0;
  const put = (next: ResourceState<T>): void => {
    current = next;
    for (const o of n.observers) mark(o, State.Dirty);
    flush();
  };
  const settle = (id: number, next: ResourceState<T>): void => {
    if (id !== latest || n.gone) return;
    const failed = attempt(() => put(next));
    // A reader threw while observing `ready`: the resource fails, via loading so transitions stay legal.
    // Errors readers throw while observing that recovery have no caller to reach and are dropped.
    if (failed && next.state === "ready") {
      attempt(() => put({ state: "loading" }));
      attempt(() => put({ state: "error", error: failed.error }));
    }
  };
  const n = watch(
    "resource",
    () => {
      const id = ++latest;
      if (current.state !== "loading") put({ state: "loading" });
      let pending: Promise<T>;
      try {
        pending = fetcher();
      } catch (error) {
        pending = Promise.reject(error);
      }
      Promise.resolve(pending).then(
        (value) => settle(id, { state: "ready", value }),
        (error: unknown) => settle(id, { state: "error", error }),
      );
    },
    [],
  );
  const handle: Resource<T> = {
    get: () => {
      track(n);
      return current;
    },
    refetch: () => {
      const r = rt.reaction;
      if (r && !r.writes.includes(handle))
        throw fail("E1201", "refetch of a resource not declared in this effect's writes");
      if (n.gone) return;
      mark(n, State.Dirty);
      flush();
    },
  };
  return handle;
}
