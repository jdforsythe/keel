import { owner, scope } from "@keel/reactive";
import { isolate } from "@keel/store";

/**
 * Runs `body` in a scope whose store registry is its own, then disposes the scope: `body` is the caller's, which builds
 * stores from a factory and reads them, so its stores never collide with a live store of the same id.
 */
export function isolated(body: () => void): void {
  const sc = scope(() => {
    const own = owner();
    if (own !== undefined) isolate(own);
    body();
  });
  sc.dispose();
}
