import type { Manifest, RouteDef } from "@keel/router";
import type { ReplayResult } from "./ReplayResult.ts";
import type { Session } from "./Session.schema.ts";
import { replayRun } from "./internal/replayRun.ts";

/**
 * Replay `session` (std.sessions API) under `createCtx({ mode: 'sim', seed })`: advance the clock to `at`, render the
 * base with `renderRoute`, then per event advance to its `at` and apply inputs (`fire`, `nav` through `navigate`);
 * `tx`, `resource` and `error` events are observations. A store the base `state` lacks starts at its `initial`.
 * A recorder on the replay's ctx gives `observed`, `error` and the fingerprint `reproduced` compares. `unapplied`:
 * the index of the input it stopped at, -1 for the base, else null. `redact`: the entries the recording ctx had
 * (every module's `std['@keel/std-sessions'].redact`), so the replay recorder redacts as the live one did.
 */
export async function replay<M extends Readonly<Record<string, RouteDef>>>(
  session: Session,
  options: { readonly routes: Manifest<M>; readonly redact?: readonly string[] },
): Promise<ReplayResult> {
  return (await replayRun(session, options)).result;
}
