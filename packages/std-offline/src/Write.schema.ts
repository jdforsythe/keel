import { s } from "@keel/schema";

/**
 * The `write` field of an endpoint body an outbox sends to (std.offline Write): `key` names the write across retries,
 * `base` is the head the writer last read and `owner` is the owner the entry was queued under. The action passes it
 * through `writeFor` with its caller's owner (std.outbox-owner).
 */
const WriteShape = s.object({ key: s.id("Write"), base: s.int({ min: 0 }), owner: s.string() });
export const Write: typeof WriteShape = WriteShape;
export type Write = s.infer<typeof WriteShape>;
