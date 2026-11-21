import type { Schema } from "@keel/schema";
import type { HostCode } from "../types/HostCode.ts";

/**
 * What `Host` hands the runtime's host element lifecycle for its element (k.host-element): `value()` reads the
 * current value (a signal's or computed's `get()`, a compiled getter, or the plain value) and changes only when
 * `live`; `code` is the prop as given, never called at render.
 */
export type HostRun<I, E> = {
  readonly id: string;
  readonly input: Schema<I>;
  readonly value: () => I;
  readonly live: boolean;
  readonly code: () => HostCode<I, E> | PromiseLike<HostCode<I, E>>;
  readonly events: Schema<E> | undefined;
  readonly onEvent: ((e: E) => void) | undefined;
};
