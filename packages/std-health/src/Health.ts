import { s } from "@keel/schema";

/** The health report of `GET /health` (std.health): status and the server clock's `now()`. */
export const Health = s.object({ status: s.literal("ok"), at: s.number() }, { closed: true });
export type Health = s.infer<typeof Health>;
