import { s } from "@keel/schema";

/**
 * A live view's state (std.live): `live` while the stream is open and the latest read since its `reset` succeeded,
 * `connecting` while it opens or that read is pending or failed, `offline` while `ctx.net.online()` is false, `denied`
 * once the channel denies.
 */
const LiveStatusShape = s.enum(["connecting", "live", "offline", "denied"]);
export const LiveStatus: typeof LiveStatusShape = LiveStatusShape;
export type LiveStatus = s.infer<typeof LiveStatusShape>;
