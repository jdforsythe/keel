import { s } from "@keel/schema";

/** The `api` deployable's runtime answer to an action that succeeded (k.server): `ok(null)`, or `ok(href)`. */
export const ActionReply = s.object({
  ok: s.literal(true),
  value: s.string().nullable(),
});
export type ActionReply = s.infer<typeof ActionReply>;
