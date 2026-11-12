import { s } from "@keel/schema";
import { FieldsReply } from "./FieldsReply.schema.ts";

/** A refused write's 422 answer as the outbox reads it (`boardWrites`): `{ ok: false, error }`, the error `keel.fields`. */
export const WriteRefusal = s.object({ ok: s.literal(false), error: FieldsReply });
export type WriteRefusal = s.infer<typeof WriteRefusal>;
