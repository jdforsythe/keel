import { Secret } from "../Secret.ts";
import type { SecretReads } from "./SecretReads.ts";
import { secretSlot } from "./secretSlot.ts";

// Evaluating `Secret.ts` fills the slot; naming the class here makes that happen before any read.
void Secret;

/** The package's reads and maker of `Secret` (k.identity Secret), filled by the class's static block. */
export const secretAccess: SecretReads = {
  of: (value, inner) => secretSlot.get().of(value, inner),
  is: (x): x is Secret<unknown> => secretSlot.get().is(x),
  open: (secret) => secretSlot.get().open(secret),
  innerOf: (secret) => secretSlot.get().innerOf(secret),
};
