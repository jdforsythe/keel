import { s } from "@keel/schema";

/** The body of a 502 from a forwarding origin whose peer is down: an `err` with code `keel.unreachable` (k.server). */
export const unreachable = s.object({ ok: s.literal(false), error: s.object({ code: s.literal("keel.unreachable") }) });
