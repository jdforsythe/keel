import { s } from "@keel/schema";

/** One `api_tokens` row as the list reads it: the id and the expiry in epoch milliseconds. */
export const TokenExpiry = s.object({ id: s.string({ min: 1, max: 64 }), expiresAt: s.int() });
