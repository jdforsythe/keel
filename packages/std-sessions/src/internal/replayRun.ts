import { bindStd } from "@keel/compiler/std/bindStd";
import { createCtx } from "@keel/ctx";
import type { JsonValue } from "@keel/schema";
import { type DocumentApp, renderRoute } from "@keel/testing";
import type { ReplayOptions } from "../ReplayOptions.ts";
import type { ReplayResult } from "../ReplayResult.ts";
import type { Session } from "../Session.schema.ts";
import { record } from "../record.ts";
import { applyInput } from "./applyInput.ts";
import { decoded } from "./decoded.ts";
import { jsonOf } from "./jsonOf.ts";
import { liveState } from "./liveState.ts";
import { pageOf } from "./pageOf.ts";
import { replayStep } from "./replayStep.ts";
import { reportUnapplied } from "./reportUnapplied.ts";
import { seededState } from "./seededState.ts";

/**
 * Replay `session` (std.sessions API) under `createCtx({ mode: 'sim', seed })`: advance the clock to `at`, render the
 * base with `renderRoute`, then per event advance to its `at` and apply inputs (`fire`, `nav` through `navigate`,
 * `net` through `setOnline`) but those the replay already produced as an earlier input's effect (`replayStep`); `tx`,
 * `resource` and `error` events are observations. An input that cannot apply ends the replay and is its error (`reportUnapplied`). A store
 * the base `state` lacks starts at its `initial`.
 * A recorder on the replay's ctx gives `observed`, `error` and the fingerprint `reproduced` compares. `unapplied`: the
 * index of the input it stopped at, -1 for the base, else null. `redact` entries are bound on the replay ctx as the
 * recording ctx had them. Also returns the replay recorder's whole session (`recorded`: inputs and observations in
 * occurrence order, its fingerprint), which `minimize` and `keel session` read.
 * With `serve` the ctx is advanced to `at`, `serve(ctx)` is called once before the recorder starts, and the base is
 * rendered with `app` (no recorded `state`); with `user` it renders signed in as `user`. A base that resumes as another
 * route is not applied: `unapplied` -1, the replay's error E2003 `base route <id> redirected to <other id>` (so it is
 * never reproduced) and `redirectedTo` that route's id.
 */
export async function replayRun(
  session: Session,
  options: ReplayOptions,
): Promise<{ readonly result: ReplayResult; readonly recorded: Session; readonly redirectedTo: string | null }> {
  const { routes } = options;
  const ctx = createCtx({ mode: "sim", seed: session.seed ?? 0 });
  // The replay recorder redacts as the live one did, so a redacted `data.at` hashes the same.
  if (options.redact !== undefined && options.redact.length > 0)
    bindStd(ctx, { "@keel/std-sessions": { replay: { redact: [...options.redact] } } });
  ctx.clock.advance(Math.max(0, session.at - ctx.clock.now()));
  let app: DocumentApp | undefined;
  let served = true;
  if (options.serve !== undefined) {
    try {
      app = await options.serve(ctx);
    } catch {
      served = false;
    }
  }
  const rec = record(ctx, { limit: Number.POSITIVE_INFINITY });
  const finish = (
    state: Readonly<Record<string, unknown>>,
    unapplied: number | null,
    redirectedTo: string | null = null,
  ): { readonly result: ReplayResult; readonly recorded: Session; readonly redirectedTo: string | null } => {
    const out = rec.stop();
    const observed = out.events.filter((e) => e.kind !== "fire" && e.kind !== "nav");
    const json: Record<string, JsonValue> = {};
    for (const [id, v] of Object.entries(state)) json[id] = jsonOf(v);
    const reproduced = out.fingerprint === session.fingerprint;
    return { result: { observed, state: json, error: out.error, reproduced, unapplied }, recorded: out, redirectedTo };
  };

  const def = pageOf(routes, session.route.id);
  if (def === undefined || !served) return finish(liveState(), -1);
  const user = options.user === undefined ? {} : { user: options.user };
  const params = decoded(def.params, session.route.params);
  const search = decoded(def.search, session.route.search);
  let h: Awaited<ReturnType<typeof renderRoute>>;
  try {
    h =
      app === undefined
        ? await renderRoute(session.route.id, {
            routes,
            params,
            search,
            state: seededState(session.state),
            ctx,
            ...user,
          })
        : await renderRoute(session.route.id, { routes, params, search, ctx, app, ...user });
  } catch {
    return finish(liveState(), -1);
  }
  const landed = app === undefined ? session.route.id : h.route().id;
  if (landed !== session.route.id) {
    reportUnapplied(ctx, -1, `base route ${session.route.id} redirected to ${landed}`);
    const end = h.state();
    h.dispose();
    return finish(end, -1, landed);
  }
  let unapplied: number | null = null;
  const step = replayStep(rec, (e) => applyInput(h, routes, ctx, e));
  for (const [i, e] of session.events.entries()) {
    if (e.at > ctx.clock.now()) ctx.clock.advance(e.at - ctx.clock.now());
    if (!(await step(e))) {
      unapplied = i;
      reportUnapplied(ctx, i);
      break;
    }
  }
  const end = h.state();
  h.dispose();
  return finish(end, unapplied);
}
