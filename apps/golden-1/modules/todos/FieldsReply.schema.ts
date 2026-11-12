import { s } from "@keel/schema";

/**
 * The `api` deployable's error answer to an action (k.server): `err` of a public KeelError. A 422 carries
 * `keel.fields` (field path to message in `data`), which the Form shows next to the field.
 */
export const FieldsReply = s.object({
  ok: s.literal(false),
  error: s.object({ code: s.string(), message: s.string(), data: s.json() }),
});
export type FieldsReply = s.infer<typeof FieldsReply>;
