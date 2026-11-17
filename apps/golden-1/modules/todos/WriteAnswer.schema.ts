import { s } from "@keel/schema";

/**
 * A write's answer as the outbox reads it (`boardWrites`): the outbox calls the `api` deployable by its origin, so it
 * decodes the whole k.server answer, `{ ok: true, value }`, where the value is the empty object the action returns.
 */
export const WriteAnswer = s.object({ ok: s.literal(true), value: s.object({}) });
export type WriteAnswer = s.infer<typeof WriteAnswer>;
