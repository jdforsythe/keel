import type { JsonValue } from "@keel/schema";
import type { Found, TestEvent } from "@keel/testing";

/**
 * One user of a group (std.multi): k.testing's harness `fire`, `navigate`, `find` and `state`, run in the user's own
 * worker, so each resolves once the call is answered there. `state()` holds every store's value as JSON.
 */
export interface GroupUser {
  fire(id: string, event: TestEvent): Promise<void>;
  navigate(href: string): Promise<void>;
  find(id: string): Promise<Found>;
  state(): Promise<{ readonly [store: string]: JsonValue }>;
}
