import type { Href } from "@keel/router";
import type { JsonValue, KeelError } from "@keel/schema";
import type { TestEvent } from "@keel/testing";

/** One recorded event (std.sessions API); `at` is `ctx.clock.now()` when it occurred. */
export type SessionEvent = { readonly at: number } & (
  | { readonly kind: "tx"; readonly store: string; readonly name: string; readonly payload: JsonValue }
  | { readonly kind: "nav"; readonly href: Href }
  | { readonly kind: "resource"; readonly id: string; readonly state: "loading" | "ready" | "error" }
  | { readonly kind: "fire"; readonly id: string; readonly event: TestEvent }
  | { readonly kind: "error"; readonly error: KeelError<string, JsonValue> }
);
