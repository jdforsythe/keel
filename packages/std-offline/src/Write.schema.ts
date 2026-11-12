import { s } from "@keel/schema";

/**
 * The `write` field of an endpoint body an outbox sends to (std.offline Write): `key` names the write across retries
 * and `base` is the head the writer last read. The action passes both to the store: `tx(t, payload, { ...input.write })`.
 */
const WriteShape = s.object({ key: s.id("Write"), base: s.int({ min: 0 }) });
export const Write: typeof WriteShape = WriteShape;
export type Write = s.infer<typeof WriteShape>;
