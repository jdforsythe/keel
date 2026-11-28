import { defect } from "../defect.ts";
import type { SecretReads } from "./SecretReads.ts";

let held: SecretReads | undefined;

/** Where `Secret`'s static block leaves the functions that reach its private fields; read only by `secretAccess`. */
export const secretSlot = {
  set(access: SecretReads): void {
    held = access;
  },
  get(): SecretReads {
    return held ?? defect("Secret is not loaded");
  },
};
