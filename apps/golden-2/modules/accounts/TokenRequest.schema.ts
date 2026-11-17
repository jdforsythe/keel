import { s } from "@keel/schema";

/** The body of `POST /api/tokens`: nothing to choose, the token lasts 30 days. */
export const TokenRequest = s.object({});

export type TokenRequest = s.infer<typeof TokenRequest>;
