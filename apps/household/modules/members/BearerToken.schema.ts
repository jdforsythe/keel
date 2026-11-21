import { s } from "@keel/schema";

/** An API token presented as `authorization: Bearer <token>`, a secret from the moment it is parsed. */
export const BearerToken = s.secret(s.string({ min: 1, max: 4096 }));
