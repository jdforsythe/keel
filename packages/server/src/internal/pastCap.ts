import { heldSet } from "@keel/schema/internal";
/**
 * The value sets past the scrub's cap (k.privacy Cost): more than 65,536 bytes of their scope's distinct values
 * (`holdValues`), or a `Secret` of more than 1,000,000 values left unread (`noteRequestSecrets`). Such a set takes no
 * more values, and `automatonOf` is `"over"` for any list holding one, so every text scrubbed with it is one mark.
 */
export const pastCap = heldSet<ReadonlySet<string>>();
