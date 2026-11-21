import type { JsonValue } from "@keel/schema";

/** A user's worker, seen from its group: `call` runs an op there; `terminate` ends it. */
export interface Realm {
  call(op: string, arg: JsonValue): Promise<JsonValue | undefined>;
  terminate(): Promise<void>;
}
