import { createCtx } from "@keel/ctx";
import type { Manifest, RouteDef } from "@keel/router";
import { matchHref } from "@keel/router/match";
import type { JsonValue } from "@keel/schema";
import { type Store, stores } from "@keel/store";
import { renderRoute } from "@keel/testing";
import type { ReplayResult } from "../ReplayResult.ts";
import type { Session } from "../Session.schema.ts";
import { record } from "../record.ts";
import { jsonOf } from "./jsonOf.ts";

type Table = Manifest<Readonly<Record<string, RouteDef>>>;

/** The decoded value of `raw` under `schema`, else `raw` (a route with no schema takes it as is). */
function decoded(
  schema: RouteDef["params"],
  raw: { readonly [k: string]: JsonValue },
): Readonly<Record<string, unknown>> {
  if (schema === undefined) return raw;
  const r = schema.parse(raw);
  return r.ok && typeof r.value === "object" && r.value !== null ? { ...r.value } : raw;
}

/**
 * Replay `session` (std.sessions API) under `createCtx({ mode: 'sim', seed })`: advance the clock to `at`, render the
 * base with `renderRoute`, then per event advance to its `at` and apply inputs (`fire`, `nav` through `navigate`);
 * `tx`, `resource` and `error` events are observations. A store the base `state` lacks starts at its `initial`.
 * A recorder on the replay's ctx gives `observed`, `error` and the fingerprint `reproduced` compares. `unapplied`: the index of the input it stopped at, -1 for the base, else null.
 * Also returns the replay recorder's whole session (`recorded`: inputs and observations in occurrence order, its
 * fingerprint), which `minimize` and `keel session` read.
 */
export async function replayRun<M extends Readonly<Record<string, RouteDef>>>(
  session: Session,
  options: { readonly routes: Manifest<M> },
): Promise<{ readonly result: ReplayResult; readonly recorded: Session }> {
  const routes: Table = options.routes;
  const ctx = createCtx({ mode: "sim", seed: session.seed ?? 0 });
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
  // Every live store is seeded, so the replay never reads what an earlier run left and `dispose` puts each back: one
  // the base `state` lacks starts at its `initial` (the base its undo replays from).
  const state: (readonly [Store<unknown>, unknown])[] = [];
  for (const [id, st] of stores())
    state.push([st, Object.hasOwn(session.state, id) ? session.state[id] : st.snapshot().initial]);
  const params = decoded(def.params, session.route.params);
  const search = decoded(def.search, session.route.search);
  let h: Awaited<ReturnType<typeof renderRoute>>;
  try {
    h = await renderRoute(session.route.id, { routes: options.routes, params, search, state, ctx });
  } catch {
    return finish(liveState(), -1);
  }
  let unapplied: number | null = null;
  for (const [i, e] of session.events.entries()) {
    if (e.at > ctx.clock.now()) ctx.clock.advance(e.at - ctx.clock.now());
    if (e.kind === "fire") {
      if (!present(h, e.id)) {
        unapplied = i;
        break;
      }
      await quiet(h.fire(e.id, e.event));
    } else if (e.kind === "nav") {
      const m = matchHref(routes, e.href);
      if (m === null) {
        unapplied = i;
        break;
      }
      await quiet(h.navigate(routes.href(m.id, m.params, m.search)));
    }
  }
  const end = h.state();
  h.dispose();
  return finish(end, unapplied);
}

const liveState = (): Readonly<Record<string, unknown>> => {
  const out: Record<string, unknown> = {};
  for (const [id, st] of stores()) out[id] = st.snapshot().state;
  return out;
};

/** Whether the render has an element `id` (`find` throws for one it has not). */
function present(h: { find(id: string): unknown }, id: string): boolean {
  try {
    h.find(id);
    return true;
  } catch {
    return false;
  }
}

/** Await an input; a throw is the app's (a Boundary catch the recorder already saw), so the replay goes on. */
async function quiet(p: Promise<void>): Promise<void> {
  try {
    await p;
  } catch {
    // Observed through `record`.
  }
}
