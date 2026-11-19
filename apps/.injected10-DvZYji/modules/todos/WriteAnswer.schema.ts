import { s } from "@keel/schema";

/** A write's answer as the outbox reads it (`boardWrites`): the empty object the `api` action returns as its `ok` value. */
export const WriteAnswer = s.object({});
export type WriteAnswer = s.infer<typeof WriteAnswer>;
