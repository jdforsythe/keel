import { heldMap } from "@keel/schema/internal";
/**
 * The count `noteRequestSecrets` returned when each request's or runner `run`'s secret set (`requestSecrets`) began.
 * A set whose count differs when a text is scrubbed (`scrubbed`) was open while the `onSecret` slot was cleared or
 * replaced, so it may lack a secret of its scope, and each text scrubbed with it is one mark.
 */
export const slotSince = heldMap<ReadonlySet<string>, number>();
