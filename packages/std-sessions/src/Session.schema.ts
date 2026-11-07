import type { Id, JsonValue, KeelError } from "@keel/schema";
import type { SessionEvent } from "./SessionEvent.ts";
import { stubSchema } from "./internal/stubSchema.ts";

/**
 * A recorded session (std.sessions API), registered as `sessions.Session` by backlog 0092. Until then the schema
 * is a placeholder whose `parse` and `encode` throw.
 */
export const Session = stubSchema<Session>("sessions.Session");
export type Session = {
  readonly v: 1;
  readonly id: Id<"Session">;
  readonly seed: number;
  readonly route: {
    readonly id: string;
    readonly params: { readonly [k: string]: JsonValue };
    readonly search: { readonly [k: string]: JsonValue };
  };
  readonly state: { readonly [storeId: string]: JsonValue };
  readonly events: readonly SessionEvent[];
  readonly error: KeelError<string, JsonValue> | null;
  readonly fingerprint: string;
};
