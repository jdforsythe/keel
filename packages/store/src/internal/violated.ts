import { s } from "@keel/schema";

/** `store.invariant`: the transaction's result failed an invariant; nothing was committed. */
export const violated = s.error("store.invariant", s.object({ transaction: s.string() }));
