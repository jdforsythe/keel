import { s } from "@keel/schema";
import { PlainDate } from "@keel/std-temporal";

/** An API token as its member sees it in the list: its id and the day it stops working. */
export const TokenInfo = s.object({ id: s.string({ min: 1, max: 64 }), expiresOn: PlainDate });
