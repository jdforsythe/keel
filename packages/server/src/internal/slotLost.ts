import { noteRequestSecrets } from "./noteRequestSecrets.ts";
import { slotSince } from "./slotSince.ts";

/**
 * The first of `sets` that was open while a package cleared or replaced the `onSecret` slot (`slotSince`), which takes
 * the slot back (`noteRequestSecrets`); `undefined` when none was. Such a set may lack a secret of its scope, so each
 * text scrubbed with it is one mark as past the cap (k.privacy Server log).
 */
export function slotLost<T extends ReadonlySet<string>>(sets: readonly T[]): T | undefined {
  const n = noteRequestSecrets();
  return sets.find((values) => (slotSince.get(values) ?? n) !== n);
}
