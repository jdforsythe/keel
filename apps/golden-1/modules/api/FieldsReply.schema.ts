import { s } from "@keel/schema";

/**
 * The `api` deployable's error answer to an action (k.server): a public KeelError. A 422 carries `keel.fields`
 * (field path to message in `data`), which the Form shows next to the field.
 */
export const FieldsReply = s.object({ code: s.string(), message: s.string(), data: s.json() });
export type FieldsReply = s.infer<typeof FieldsReply>;
