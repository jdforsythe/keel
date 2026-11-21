import { s } from "@keel/schema";

/** The token a revoke names, by its id. */
export const TokenRef = s.object({ id: s.string({ min: 1, max: 64 }) });
