import { s } from "@keel/schema";

/** One row of `list_writes`: the key of a write that committed. */
export const WriteKey = s.object({ key: s.string() });
