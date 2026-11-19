import type { s } from "@keel/schema";
import { FieldsReply } from "./FieldsReply.schema.ts";

/** A refused write's 422 error as the outbox reads it (`boardWrites`): the `api` action's `keel.fields` error. */
export const WriteRefusal: typeof FieldsReply = FieldsReply;
export type WriteRefusal = s.infer<typeof WriteRefusal>;
