import { s } from "@keel/schema";
import { Digested } from "@keel/std-credentials";

/** A minted API token as stored: its id, the digest of its text and the account it acts for. */
export const ApiToken = s.object({ id: s.string({ min: 1 }), digest: Digested, userId: s.id("User") });

export type ApiToken = s.infer<typeof ApiToken>;
