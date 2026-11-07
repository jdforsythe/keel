import type { Ctx } from "@keel/ctx";
import type { SessionSink } from "./SessionSink.ts";
import { notImplemented } from "./internal/notImplemented.ts";

/**
 * Accessor of the `session` capability (`register('session', { real, shell, sim })`, k.ctx). Placeholder until
 * backlog 0092. `Session` lives in `Session.schema.ts`, so the two names do not collide on case-insensitive disks.
 */
export function session(_ctx: Ctx): SessionSink {
  throw notImplemented("session");
}
