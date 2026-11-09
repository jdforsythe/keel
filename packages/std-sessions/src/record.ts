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
 * state, transaction and error, redacted, in a ring buffer of `limit` (default 500) events. One recorder per ctx until
 * its `stop()`: while one is active, `record` returns it and ignores `options`; it outlives the component that called
 * `record`. Without a global `document` (a server render) it records nothing and never puts. With `upload`, the first
 * error puts the session so far through `session(ctx)`. Uploads are same-origin, since the ingest route refuses a
 * cross-site write: an `upload` whose origin is not the page's (or a page with an opaque origin) throws E2006 here.
 */
export function record(ctx: Ctx, options: RecordOptions = {}): Recorder {
  const active = actives.get(ctx);
  if (active !== undefined) return active.recorder;
  if (typeof document === "undefined") {
    const live = inert(ctx);
    actives.set(ctx, live);
    return live.recorder;
  }
  const page = typeof location === "undefined" ? "null" : location.origin;
  const upload = options.upload;
  if (upload !== undefined && (page === "null" || upload.origin !== page))
    throw Object.assign(
      new Error(`E2006 upload origin ${upload.origin} is not the page's (${page}); serve routes here`),
      {
        code: "E2006",
        see: "std.sessions",
      },
    );
  const live = recording(ctx, options);
  actives.set(ctx, live);
  return live.recorder;
}

inspector({ id: "sessions.live", schema: Session.nullable(), read: (ctx) => actives.get(ctx)?.peek() ?? null });
