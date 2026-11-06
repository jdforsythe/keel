import { s } from "@keel/schema";

/** The `api` deployable's 422 answer to an action (k.server): `err` `keel.fields`, field path to message. */
export const FieldsReply = s.object({
  ok: s.literal(false),
  error: s.object({ code: s.literal("keel.fields"), message: s.string(), data: s.record(s.string()) }),
});
export type FieldsReply = s.infer<typeof FieldsReply>;
