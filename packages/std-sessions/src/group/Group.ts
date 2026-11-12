import type { GroupUser } from "./GroupUser.ts";
import type { SessionGroup } from "./SessionGroup.schema.ts";

/**
 * An open session group (std.multi). `user(i)` drives user `i`; `setOnline(i, b)` switches its sim net; `advance(ms)`
 * moves every clock, the server's included; `settle()` resolves when no request or stream chunk is in flight and every
 * user has settled; `stop()` settles, ends every user's worker and returns the `SessionGroup`.
 */
export interface Group {
  user(i: number): GroupUser;
  setOnline(i: number, online: boolean): Promise<void>;
  advance(ms: number): Promise<void>;
  settle(): Promise<void>;
  stop(): Promise<SessionGroup>;
}
