// Shared fixtures for the std.sessions served-page conformance files (rfc:0215). Property seed: 1337.
// `fixtures/guarded/` is a project on disk (topology `api`, a `node` deployable, module `a`): `a.board` is guarded by
// a guard admitting only user `u1` and redirecting anyone else to `a.signin`; `a.about` and `a.help` are public. Its
// route table is imported here in this process, so the library and `keel session` run the same pages and guard.
import { createCtx } from "@keel/ctx";
import type { SimCtx } from "@keel/ctx";
import { createApp, topology } from "@keel/server";
import type { Session } from "@keel/std-sessions";
import { record } from "@keel/std-sessions";
import { renderRoute } from "@keel/testing";
import { a } from "./fixtures/guarded/modules/a/a.contract.ts";
import { routes } from "./fixtures/guarded/modules/a/routes.ts";

export const SEED = 1337;
export const AT = 1_794_262_903_390;
export const guardedRoutes = routes;
export const guardedContract = a;

const apiTopology = topology({ api: { modules: ["a"], adapter: "node" } });

/** The app of deployable `api` over `ctx`, as the generated entry builds it. */
export const buildApp = (ctx: SimCtx) => createApp({ topology: apiTopology, deployable: "api", routes, ctx });

/** A `serve` counting its calls and the ctx each call was given. */
export function countingServe() {
  const ctxs: SimCtx[] = [];
  const serve = (ctx: SimCtx) => {
    ctxs.push(ctx);
    return buildApp(ctx);
  };
  return { serve, ctxs };
}

export type Page = "a.board" | "a.about" | "a.help";

/**
 * A session recorded under `renderRoute` with `app` on a sim ctx of `seed`, at `AT`: the base page, then a navigation
 * to each of `visits`. Returns the session and the final `state()` of the live harness.
 */
export async function recordServed(
  base: Page,
  visits: readonly ("a.about" | "a.help")[],
  options: { readonly user?: string; readonly seed?: number } = {},
): Promise<{ session: Session; live: Readonly<Record<string, unknown>> }> {
  const ctx = createCtx({ mode: "sim", seed: options.seed ?? SEED });
  ctx.clock.advance(AT);
  const app = await buildApp(ctx);
  const rec = record(ctx);
  const opts = {
    routes,
    params: {},
    search: {},
    ctx,
    app,
    ...(options.user === undefined ? {} : { user: options.user }),
  };
  const h = await renderRoute(base, opts);
  for (const v of visits) {
    ctx.clock.advance(10);
    await h.navigate(a.href(v));
  }
  const live = h.state();
  const session = rec.stop();
  h.dispose();
  return { session, live };
}
