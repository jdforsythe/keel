import { s } from "@keel/schema";

/** A signed-in browser: the request's `caller` and the account it signed in as. */
export const Session = s.object({ caller: s.string({ min: 1 }), userId: s.id("User") });

export type Session = s.infer<typeof Session>;
