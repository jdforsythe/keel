import { owner, scope } from "@keel/reactive";
import { isolate } from "@keel/store";
import { unsafe } from "./unsafe.ts";

/**
 * Runs `body` in a detached scope (k.reactive E1207) whose store registry is its own, then disposes the scope: `body`
 * is the caller's, which builds stores from a factory and reads them.
 */
export function isolated(body: () => void): void {
  unsafe(
    "a stores factory runs in a scope of its own so its stores never collide with a live store of the same id, and the scope is disposed before the call returns, so it has no owner to nest in",
    () => {
      const sc = scope(
        () => {
          const own = owner();
          if (own !== undefined) isolate(own);
          body();
        },
        { detached: true },
      );
      sc.dispose();
    },
  );
}
