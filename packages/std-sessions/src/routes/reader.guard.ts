import { stdConfig } from "@keel/compiler/std/stdConfig";
import { guard } from "@keel/router";
import { err, ok } from "@keel/schema";
import { SessionsConfig } from "../SessionsConfig.ts";

/**
 * Guard `sessions.reader` (std.sessions Ingest): admits a `caller` in the merged `readers` of every
 * module's `std['@keel/std-sessions']` (server-only config); else `keel.denied`, which redirects (302) to
 * `sessions.ingest` with `next`. An absent or empty list denies everyone, and so does the anonymous caller `""`.
 */
export const reader = guard({ redirect: "sessions.ingest" }, async ({ caller }, ctx) => {
  const readers = Object.values(stdConfig(ctx, "@keel/std-sessions", SessionsConfig)).flatMap((c) => c.readers ?? []);
  return caller !== "" && readers.includes(caller)
    ? ok(null)
    : err({ code: "keel.denied", message: "not a sessions reader", data: null });
});
