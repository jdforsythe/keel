import { s } from "@keel/schema";
import { Digested } from "@keel/std-credentials";

/**
 * A minted API token as stored: its id, the digest of its text and the user it acts for, the id the sign-in library
 * gave that user (an account identifier, so personal data).
 */
export const ApiToken = s.object({
  id: s.string({ min: 1 }),
  digest: Digested,
  userId: s.string({ min: 1, max: 256 }).pii("identifier"),
});

export type ApiToken = s.infer<typeof ApiToken>;
