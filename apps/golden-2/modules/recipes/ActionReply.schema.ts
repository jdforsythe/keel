import { s } from "@keel/schema";

export const ActionReply = s.object({ ok: s.literal(true), value: s.string().nullable() });

export type ActionReply = s.infer<typeof ActionReply>;
