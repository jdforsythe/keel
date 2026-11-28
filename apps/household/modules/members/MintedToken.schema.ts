import { s } from "@keel/schema";
import { PlainDate } from "@keel/std-temporal";

/** The answer of `POST /api/tokens`: the token text, shown this once, its id and the day it stops working. */
export const MintedToken = s.object({ token: s.string(), id: s.string(), expiresOn: PlainDate });
