import type { Schema } from "@keel/schema";
import type { HostStart } from "./HostStart.ts";

/**
 * One host element for the `host` op (k.host-element): its id, `input` schema, the reader of its current value
 * (`live` when the value can change), its `code` (never called at render) and, with `events`, `onEvent`.
 */
export type HostDef<I, E> = {
  readonly id: string;
  readonly input: Schema<I>;
  readonly value: () => I;
  readonly live: boolean;
  readonly code: () => HostStart<I, E> | PromiseLike<HostStart<I, E>>;
  readonly events: Schema<E> | undefined;
  readonly onEvent: ((e: E) => void) | undefined;
};
