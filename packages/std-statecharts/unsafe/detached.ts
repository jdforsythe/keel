import { scope } from "@keel/reactive";
import { unsafe } from "./unsafe.ts";

/** Runs `fn` in a scope no owner disposes (k.reactive E1207): a chart declared at module level, outside every scope. */
export function detached<T>(fn: () => T): T {
  return unsafe(
    "a chart declared at module level owns its store for the module's whole life, as a module-level store does, so its scope has no owner to nest in and none disposes it",
    () => scope(() => undefined, { detached: true }).run(fn),
  );
}
