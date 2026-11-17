import { s } from "@keel/schema";

/** The answer of `POST /api/tokens`: the token text, shown this once, its id and when it expires. */
export const MintedToken = s.object({ token: s.string(), id: s.string(), expiresAt: s.int().nullable() });

export type MintedToken = s.infer<typeof MintedToken>;
