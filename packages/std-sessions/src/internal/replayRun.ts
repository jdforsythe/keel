import { bindStd } from "@keel/compiler/std/bindStd";
import { createCtx } from "@keel/ctx";
import type { Manifest, RouteDef } from "@keel/router";
import type { JsonValue } from "@keel/schema";
import { renderRoute } from "@keel/testing";
import type { ReplayResult } from "../ReplayResult.ts";
import type { Session } from "../Session.schema.ts";
import { record } from "../record.ts";
import { applyInput } from "./applyInput.ts";
import { decoded } from "./decoded.ts";
import { jsonOf } from "./jsonOf.ts";
import { liveState } from "./liveState.ts";
import { replayStep } from "./replayStep.ts";
import { reportUnapplied } from "./reportUnapplied.ts";
import { seededState } from "./seededState.ts";

type Table = Manifest<Readonly<Record<string, RouteDef>>>;

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
 */
export async function replayRun<M extends Readonly<Record<string, RouteDef>>>(
  session: Session,
  options: { readonly routes: Manifest<M>; readonly redact?: readonly string[] },
): Promise<{ readonly result: ReplayResult; readonly recorded: Session }> {
  const routes: Table = options.routes;
  const ctx = createCtx({ mode: "sim", seed: session.seed ?? 0 });
  // The replay recorder redacts as the live one did, so a redacted `data.at` hashes the same.
  if (options.redact !== undefined && options.redact.length > 0)
    bindStd(ctx, { "@keel/std-sessions": { replay: { redact: [...options.redact] } } });
  ctx.clock.advance(Math.max(0, session.at - ctx.clock.now()));
  const rec = record(ctx, { limit: Number.POSITIVE_INFINITY });
  const finish = (
    state: Readonly<Record<string, unknown>>,
    unapplied: number | null,
  ): { readonly result: ReplayResult; readonly recorded: Session } => {
    const out = rec.stop();
    const observed = out.events.filter((e) => e.kind !== "fire" && e.kind !== "nav");
    const json: Record<string, JsonValue> = {};
    for (const [id, v] of Object.entries(state)) json[id] = jsonOf(v);
    const reproduced = out.fingerprint === session.fingerprint;
    return { result: { observed, state: json, error: out.error, reproduced, unapplied }, recorded: out };
  };

  const def = Object.hasOwn(routes.routes, session.route.id) ? routes.routes[session.route.id] : undefined;
  if (def?.path === undefined) return finish(liveState(), -1);
  const state = seededState(session.state);
  const params = decoded(def.params, session.route.params);
  const search = decoded(def.search, session.route.search);
  let h: Awaited<ReturnType<typeof renderRoute>>;
  try {
    h = await renderRoute(session.route.id, { routes: options.routes, params, search, state, ctx });
  } catch {
    return finish(liveState(), -1);
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
