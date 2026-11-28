import { s } from "@keel/schema";

/** `Intl` threw a `RangeError` or a `TypeError` for an input: nothing of the throw is kept but its class. */
export const IntlRefused = s.error("i18n.intlRefused", s.object({ thrown: s.enum(["RangeError", "TypeError"]) }));
