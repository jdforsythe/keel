import { s } from "@keel/schema";

/** `store.undeclared`: the calling scope declared `uses` without this transaction (runtime E1301). */
export const undeclared = s.error("store.undeclared", s.object({ transaction: s.string() }));
