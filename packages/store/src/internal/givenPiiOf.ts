import { heldMap } from "@keel/schema/internal";
/** Per committed log entry, in memory: what `givenPii` returns for it. A dropped entry drops its list. */
export const givenPiiOf = heldMap<object, readonly string[]>();
