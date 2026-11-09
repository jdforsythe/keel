import { inspector } from "@keel/compiler/inspect/inspector";
import type { Ctx } from "@keel/ctx";
import type { RecordOptions } from "./RecordOptions.ts";
import type { Recorder } from "./Recorder.ts";
import { Session } from "./Session.schema.ts";
import { actives } from "./internal/actives.ts";
import { inert } from "./internal/inert.ts";
import { recording } from "./internal/recording.ts";

/**
 * Record a session on `ctx` (std.sessions API): the base route and state, then every navigation, input, resource
 * state, transaction and error, redacted, in a ring buffer of `limit` (default 500) events. One recorder per ctx: while
 * one is active, `record` returns it and ignores `options`. Without a global `document` (a server render) it records
 * nothing and never puts. With `upload`, the first error puts the session so far through `session(ctx)`.
 */
export function record(ctx: Ctx, options: RecordOptions = {}): Recorder {
  const active = actives.get(ctx);
  if (active !== undefined) return active.recorder;
  const live = typeof document === "undefined" ? inert(ctx) : recording(ctx, options);
  actives.set(ctx, live);
  return live.recorder;
}

inspector({ id: "sessions.live", schema: Session.nullable(), read: (ctx) => actives.get(ctx)?.peek() ?? null });
