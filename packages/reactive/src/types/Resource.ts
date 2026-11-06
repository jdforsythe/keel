import type { ResourceState } from "./ResourceState.ts";

/** Async value. `get()` is reactive; `refetch()` starts a new request and discards older ones. */
export interface Resource<T> {
  get(): ResourceState<T>;
  refetch(): void;
}
