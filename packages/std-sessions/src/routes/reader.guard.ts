import { stdConfig } from "@keel/compiler/std/stdConfig";
import { guard } from "@keel/router";
import { err, ok } from "@keel/schema";
import { SessionsConfig } from "../SessionsConfig.ts";

/**
 * Guard `sessions.reader` (std.sessions Ingest): admits a request whose `user` (k.user) or `caller` is in the merged
 * `readers` of every module's `std['@keel/std-sessions']` (server-only config); else `keel.denied` (403). It guards API
 * routes only. An absent or empty list denies everyone, and `""` (no user, the anonymous caller) is never admitted.
 */
export const reader = guard({}, async ({ caller, user }, ctx) => {
  const readers = Object.values(stdConfig(ctx, "@keel/std-sessions", SessionsConfig)).flatMap((c) => c.readers ?? []);
  return [caller, user].some((id) => id !== "" && readers.includes(id))
    ? ok(null)
    : err({ code: "keel.denied", message: "not a sessions reader", data: null });
});
