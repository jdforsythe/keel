import { s } from "@keel/schema";

/** The draft being typed, the notes saved, the server's caller as it last answered, the feed's first chunk. */
export const Notes = s.object({ draft: s.string(), items: s.array(s.string()), caller: s.string(), peek: s.string() });
