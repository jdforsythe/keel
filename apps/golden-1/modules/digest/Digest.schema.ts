import { s } from "@keel/schema";

/** Open and done todo counts across the board, and the `ctx.clock` time `digest.recount` counted them. */
export const Digest = s.object({ open: s.int({ min: 0 }), done: s.int({ min: 0 }), at: s.number() });
export type Digest = s.infer<typeof Digest>;
