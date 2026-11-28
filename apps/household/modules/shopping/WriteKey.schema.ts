import { s } from "@keel/schema";

/** One row of `list_writes`: the key of a write that committed, and the member who sent it. */
export const WriteKey = s.object({ owner: s.string().pii("identifier"), key: s.string() });
