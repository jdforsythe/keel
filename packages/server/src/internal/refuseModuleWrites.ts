import { moduleWrites } from "@keel/store/internal";
import { serving } from "./serving.ts";

/**
 * Makes `tx` on a module-registry store throw E1256 while a request runs (`serving`), changing nothing (k.resume Stores;
 * `keel explain E1256` names the fix). Each `createApp` calls it, so the check is installed again after another took
 * the slot.
 */
export function refuseModuleWrites(): void {
  moduleWrites.check = (id) => {
    if (serving.getStore()) throw new Error(`E1256 tx on module store ${id} during a request`);
  };
}
