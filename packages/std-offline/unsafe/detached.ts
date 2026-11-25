import { scope } from "@keel/reactive";
import { unsafe } from "./unsafe.ts";

/**
 * Runs `make` in a scope no owner disposes (k.reactive E1207): `make` is the outbox's own, which creates its store and
 * its transactions and nothing else.
 */
export function detached<T>(make: () => T): T {
  return unsafe(
    "an outbox declared at module level owns its store for the module's whole life, as a module-level store does, so its scope has no owner to nest in and none disposes it",
    () => scope(() => undefined, { detached: true }).run(make),
  );
}
