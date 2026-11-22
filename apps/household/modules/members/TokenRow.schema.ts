import { s } from "@keel/schema";
import { Digested } from "@keel/std-tokens";

/** An API token as `check` reads it: its id, the digest of its text and the member it acts for. */
export const TokenRow = s.object({
  id: s.string({ min: 1, max: 64 }),
  digest: Digested,
  userId: s.string({ min: 1, max: 256 }).pii("identifier"),
});
