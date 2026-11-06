import { State } from "./internal/State.ts";
import { dispose } from "./internal/dispose.ts";
import { flush } from "./internal/flush.ts";
import { mark } from "./internal/mark.ts";
import { watch } from "./internal/watch.ts";
import { signal } from "./signal.ts";
import type { Resource } from "./types/Resource.ts";
import type { ResourceState } from "./types/ResourceState.ts";

/**
 * Async value. `fetcher` runs at creation, on `refetch()`, and when a signal it read synchronously
 * changes. Every run gets a higher request id; only the latest request may settle the state.
 */
export function resource<T>(fetcher: () => Promise<T>): Resource<T> {
  const state = signal<ResourceState<T>>({ state: "loading" });
  let current: ResourceState<T> = { state: "loading" };
  let latest = 0;
  const put = (next: ResourceState<T>): void => {
    current = next;
    state.set(next);
  };
  const n = watch(() => {
    const id = ++latest;
    if (current.state !== "loading") put({ state: "loading" });
    let pending: Promise<T>;
    try {
      pending = fetcher();
    } catch (error) {
      pending = Promise.reject(error);
    }
    Promise.resolve(pending).then(
      (value) => {
        if (id === latest && !n.gone) put({ state: "ready", value });
      },
      (error: unknown) => {
        if (id === latest && !n.gone) put({ state: "error", error });
      },
    );
  }, [state]);
  return {
    get: () => state.get(),
    refetch: () => {
      if (n.gone) return;
      mark(n, State.Dirty);
      flush();
    },
  };
}
