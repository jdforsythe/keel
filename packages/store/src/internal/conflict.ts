import { s } from "@keel/schema";

/** `keel.conflict`: a `'reject'` transaction got a `base` other than the store's head; nothing was committed. */
export const conflict = s.error(
  "keel.conflict",
  s.object({ store: s.string(), transaction: s.string(), base: s.int(), head: s.int() }),
);
