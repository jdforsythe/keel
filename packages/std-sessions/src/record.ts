import { inspector } from "@keel/compiler/inspect/inspector";
import type { Ctx } from "@keel/ctx";
import type { RecordOptions } from "./RecordOptions.ts";
import type { Recorder } from "./Recorder.ts";
import { Session } from "./Session.schema.ts";
import { actives } from "./internal/actives.ts";
import { inert } from "./internal/inert.ts";
import { pageOrigin } from "./internal/pageOrigin.ts";
import { recording } from "./internal/recording.ts";
import { uploadable } from "./internal/uploadable.ts";

/**
 * Record a session on `ctx` (std.sessions API): the base route and state, then every navigation, input, resource
 * state, transaction and error, redacted, in a ring buffer of `limit` (default 500) events. One recorder per ctx until
 * its `stop()`: while one is active, `record` returns it and ignores `options`; it outlives the component that called
 * `record`. Without a global `document` (a server render) it records nothing and never puts. With `upload`, the first
 * error puts the session so far through `session(ctx)`. Uploads are same-origin, since the ingest route refuses a
 * cross-site write: an `upload` that is not credential-free http(s) on the page's origin (`self.origin`; an opaque
 * page has none) throws E2006 here.
 */
export function record(ctx: Ctx, options: RecordOptions = {}): Recorder {
  const active = actives.get(ctx);
  if (active !== undefined) return active.recorder;
  if (typeof document === "undefined") {
    const live = inert(ctx);
    actives.set(ctx, live);
    return live.recorder;
  }
  const upload = options.upload;
  if (upload !== undefined) {
    const page = pageOrigin();
    if (!uploadable(upload, page))
      throw Object.assign(
        new Error(`E2006 upload ${upload.protocol}//${upload.host} is not this page's origin (${page})`),
        {
          code: "E2006",
          see: "std.sessions",
        },
      );
  }
  const live = recording(ctx, options);
  actives.set(ctx, live);
  return live.recorder;
}

inspector({ id: "sessions.live", schema: Session.nullable(), read: (ctx) => actives.get(ctx)?.peek() ?? null });
