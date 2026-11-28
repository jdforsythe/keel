import { heldMap } from "@keel/schema/internal";
/** Per live store, in memory: what `givenPii` returns for it, read when asked. */
export const statePiiOf = heldMap<object, () => readonly string[]>();
