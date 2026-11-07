import { s } from "@keel/schema";
import { KeelFields } from "./KeelFields.schema.ts";

export const FieldsReply = s.object({ ok: s.literal(false), error: KeelFields });

export type FieldsReply = s.infer<typeof FieldsReply>;
