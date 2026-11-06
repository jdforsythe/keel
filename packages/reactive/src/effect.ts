import { dispose } from "./internal/dispose.ts";
import { watch } from "./internal/watch.ts";
import type { Effect } from "./types/Effect.ts";
import type { Resource } from "./types/Resource.ts";
import type { Signal } from "./types/Signal.ts";

/**
 * Run `fn` now (or at the end of the open batch) and again after every commit that changed
 * something it read. Writing a signal, or refetching a resource, not listed in `writes` is E1201;
 * invalidating itself is E1202.
 */
export function effect(
  fn: () => void,
  options?: { writes?: readonly (Signal<unknown> | Resource<unknown>)[] },
): Effect {
  const n = watch("effect", fn, options?.writes ?? []);
  return { dispose: () => dispose(n) };
}
