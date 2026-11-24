import type { ReplayOptions } from "./ReplayOptions.ts";
import type { ReplayResult } from "./ReplayResult.ts";
import type { Session } from "./Session.schema.ts";
import { replayRun } from "./internal/replayRun.ts";

/**
 * Replay `session` (std.sessions API) under `createCtx({ mode: 'sim', seed })`: advance the clock to `at`, render the
 * base with `renderRoute`, then per event advance to its `at` and apply inputs (`fire`, `nav` through `navigate`,
 * `net` through `setOnline`), passing over an input the replay already produced as the effect of the one before it
 * (the `submit` a click on a submit button dispatches, the `nav` an action ends with); `tx`, `resource` and `error`
 * events are observations. A store the base `state` lacks starts at its `initial`. A recorder on the replay's ctx
 * gives `observed`, `error` and the fingerprint `reproduced` compares; an input that cannot apply is the replay's
 * `E2003` error, so it is not reproduced unless the session's first error came before it. `unapplied`: the index of
 * the input it stopped at, -1 for the base, else null. `redact`: the entries the recording ctx had
 * (every module's `std['@keel/std-sessions'].redact`), so the replay recorder redacts as the live one did.
 * `serve(ctx)` (called once, on the replay ctx advanced to `at`) resolves a `createApp` result: the base is then
 * rendered with `renderRoute` and `app`, so guards, loaders and actions run in the app over an empty sim storage; the
 * recorded `state` is not applied. `user` renders the base signed in as that id. A base page that redirected is never
 * reproduced: `unapplied` -1, whatever the session recorded.
 */
export async function replay(session: Session, options: ReplayOptions): Promise<ReplayResult> {
  return (await replayRun(session, options)).result;
}
