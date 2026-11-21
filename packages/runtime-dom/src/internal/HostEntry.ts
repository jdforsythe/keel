import type { JsonValue } from "@keel/schema";
import type { InvalidValueError } from "../types/InvalidValueError.ts";

/** A rendered host element as the harness reads it (k.host-element Harness and replay). */
export interface HostEntry {
  /** The latest value that parsed, encoded by `input`'s codec. */
  value(): JsonValue;
  /** Parse `detail` with `events`, report the `fire`, call `onEvent`; the `schema.invalid` (and nothing done) when it fails. */
  emit(detail: unknown): InvalidValueError | null;
}
