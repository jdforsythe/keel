import type { Ctx } from "@keel/ctx";
import { batch, computed, owner, scope, signal } from "@keel/reactive";
import { boundary } from "@keel/runtime-dom/ops";
import { type KeelError, type Result, attempt, err, ok } from "@keel/schema";
import type { Located } from "./internal/Located.ts";
import type { Match } from "./internal/Match.ts";
import type { Place } from "./internal/Place.ts";
import type { RouterCore } from "./internal/RouterCore.ts";
import type { View } from "./internal/View.ts";
import { absoluteUrl } from "./internal/absoluteUrl.ts";
import { afterNavigate } from "./internal/afterNavigate.ts";
import { compileRoutes } from "./internal/compileRoutes.ts";
import { compileTable } from "./internal/compileTable.ts";
import { defaultError } from "./internal/defaultError.ts";
import { fieldsError } from "./internal/fieldsError.ts";
import { guardTable } from "./internal/guardTable.ts";
import { hrefIn } from "./internal/hrefIn.ts";
import { isRouteStateOf } from "./internal/isRouteStateOf.ts";
import { matchUrl } from "./internal/matchUrl.ts";
import { needsBare } from "./internal/needsBare.ts";
import { notFound } from "./internal/notFound.ts";
import { renderView } from "./internal/renderView.ts";
import { rooted } from "./internal/rooted.ts";
import { routers } from "./internal/routers.ts";
import { runGuard } from "./internal/runGuard.ts";
import { runLoaders } from "./internal/runLoaders.ts";
import { tables } from "./internal/tables.ts";
import { unexpected } from "./internal/unexpected.ts";
import type { Href } from "./types/Href.ts";
import type { Manifest } from "./types/Manifest.ts";
import type { RouteDef } from "./types/RouteDef.ts";
import type { RouteState } from "./types/RouteState.ts";
import type { Router } from "./types/Router.ts";
import type { RouterHistory } from "./types/RouterHistory.ts";

type Mode = "push" | "replace" | "pop" | "initial" | "stay";
type Outcome = Result<unknown, KeelError<string, unknown>>;
type Failure = { readonly level: number; readonly bare: boolean; readonly error: KeelError<string, unknown> };

const MISSING: Place = { id: null, params: {}, search: {} };
const MAX_REDIRECTS = 8;
const done = Promise.resolve();

/** Nearest chain index at or above `from` whose route has an `errorElement`; -1 when none. */
const nearestErrorElement = (route: Located, from: number): number => {
  for (let i = Math.min(from, route.chain.length - 1); i >= 0; i--)
    if (route.chain[i]?.def.errorElement !== undefined) return i;
  return -1;
};

/**
 * Start a client router over `routes` (k.router Client). Navigation: match, parse params (fail: 404 to the
 * nearest errorElement, no loader) and search (failing keys dropped), run every guard outermost first
 * (denied: redirect to the guard's `redirect` with `?next=`), then every loader of the chain concurrently,
 * then commit. The previous page stays rendered and `pending` is true until the commit.
 */
export function createRouter<M extends Readonly<Record<string, RouteDef>>>(
  routes: Manifest<M>,
  opts: { readonly ctx: Ctx; readonly history: RouterHistory },
): Router<RouteState<M>> {
  const { ctx, history } = opts;
  const own = tables.get(routes) ?? compileRoutes(routes.routes);
  const table = compileTable(own, routes.routes);
  const root = rooted(() => {
    const view = signal<View | null>(null);
    const place = signal<Place>(MISSING);
    const pending = signal(false);
    const route = computed((): RouteState<M> => {
      const state = { ...place.get(), pending: pending.get() };
      if (isRouteStateOf(routes.routes, state)) return state;
      throw new Error(`k.router: route id ${String(state.id)} is not in this manifest`);
    });
    return { view, place, pending, route };
  });
  const { view, place, pending, route } = root.value;
  const scrolls = new Map<string, number>();
  let token = 0;
  let disposed = false;
  let committedUrl: string | null = null;
  let anchor: Node | null = null;
  let resetRoot: (() => void) | null = null;

  const makeView = (m: Match, results: readonly Outcome[], failure: Failure | null): View => {
    const chain = m.route?.chain ?? [];
    const made = rooted(() => ({
      data: chain.map((_, i) => signal(results[i]?.ok === true ? results[i].value : undefined)),
    }));
    return {
      url: m.url,
      chain,
      params: m.kind === "route" ? m.params : {},
      search: m.kind === "route" ? m.search : {},
      data: made.value.data,
      error: failure,
      scope: made.scope,
    };
  };
  const placeOf = (m: Match): Place =>
    m.kind === "route" ? { id: m.route.id, params: m.params, search: m.search } : MISSING;
  const loaded = (m: Match, results: readonly Outcome[]): View => {
    const f = results.findIndex((r) => !r.ok);
    const failed = results[f];
    if (m.route === null || failed === undefined || failed.ok) return makeView(m, results, null);
    return makeView(m, results, { level: nearestErrorElement(m.route, f), bare: false, error: failed.error });
  };
  const failedAt = (m: Match, level: number, error: KeelError<string, unknown>): View => {
    const at = m.route === null ? -1 : nearestErrorElement(m.route, level);
    return makeView(m, [], { level: at, bare: needsBare(m.route?.chain ?? [], at), error });
  };

  const commit = (t: number, next: View, at: Place, mode: Mode): void => {
    if (t !== token || disposed) {
      next.scope.dispose();
      return;
    }
    const w = typeof window === "undefined" ? null : window;
    if (w !== null && committedUrl !== null && mode !== "stay") scrolls.set(committedUrl, w.scrollY);
    if (mode === "push") history.push(next.url);
    else if (mode === "replace" || ((mode === "initial" || mode === "pop") && history.current() !== next.url))
      history.replace(next.url);
    committedUrl = next.url;
    const prev = view.get();
    batch(() => {
      view.set(next);
      place.set(at);
      pending.set(false);
    });
    prev?.scope.dispose();
    const reset = resetRoot;
    resetRoot = null;
    reset?.();
    if (mode === "push" || mode === "replace") afterNavigate(anchor?.parentNode ?? null, next.url);
    else if (mode === "pop" && w !== null) w.scrollTo(0, scrolls.get(next.url) ?? 0);
  };

  const redirectTo = (id: string, next: string): Result<string, KeelError<string, unknown>> => {
    const r = attempt(() => hrefIn(own, id, {}, {}));
    if (!r.ok) return err(unexpected(`guard redirect to "${id}" failed: ${r.error.message}`));
    const base = String(r.value);
    return ok(`${base}${base.includes("?") ? "&" : "?"}next=${encodeURIComponent(next)}`);
  };

  const proceed = async (t: number, m: Match & { kind: "route" }, mode: Mode, hops: number): Promise<void> => {
    for (const [i, lvl] of m.route.chain.entries()) {
      const name = lvl.def.guard;
      if (name === undefined) continue;
      const g = guardTable.get(name);
      if (g === undefined)
        return commit(t, failedAt(m, i, unexpected(`E1506 unknown guard "${name}"`)), placeOf(m), mode);
      const r = await runGuard(g, m.url, ctx);
      if (t !== token) return;
      if (r.ok) continue;
      if (r.error.code !== "keel.denied") return commit(t, failedAt(m, i, r.error), placeOf(m), mode);
      const to = hops < MAX_REDIRECTS ? redirectTo(g.redirect, m.url) : err(unexpected("too many guard redirects"));
      if (!to.ok) return commit(t, failedAt(m, i, to.error), placeOf(m), mode);
      return go(to.value, mode === "push" ? "push" : "replace", hops + 1);
    }
    const results = await runLoaders(
      m.route.chain,
      { params: m.params, search: m.search, url: absoluteUrl(m.url) },
      ctx,
    );
    if (t !== token) return;
    commit(t, loaded(m, results), placeOf(m), mode);
  };

  const go = (url: string, mode: Mode, hops: number): Promise<void> => {
    if (disposed) return done;
    const t = ++token;
    const m = matchUrl(table, url);
    if (m.kind === "notFound") {
      commit(t, failedAt(m, Number.MAX_SAFE_INTEGER, notFound(m.url)), MISSING, mode);
      return done;
    }
    if (view.get() === null) place.set(placeOf(m));
    if (m.route.chain.every((l) => l.def.guard === undefined && l.def.loader === undefined)) {
      commit(t, loaded(m, []), placeOf(m), mode);
      return done;
    }
    pending.set(true);
    return proceed(t, m, mode, hops);
  };

  const revalidate = async (): Promise<void> => {
    const v = view.get();
    const m = v === null ? null : matchUrl(table, v.url);
    if (v === null || m === null || m.kind !== "route") return;
    const t = token;
    pending.set(true);
    const results = await runLoaders(v.chain, { params: v.params, search: v.search, url: absoluteUrl(v.url) }, ctx);
    if (t !== token || disposed || view.get() !== v) return;
    if (v.error !== null || results.some((r) => !r.ok)) return commit(t, loaded(m, results), placeOf(m), "stay");
    batch(() => {
      for (const [i, r] of results.entries()) if (r.ok) v.data[i]?.set(r.value);
      pending.set(false);
    });
  };

  const core: RouterCore = {
    table: own,
    async submit(req) {
      const handle = req.handle;
      if (handle !== undefined && !handle.validate().ok) return null;
      const act = own.get(req.action)?.def.actions?.[req.method];
      if (act === undefined || disposed) return null;
      const data = new FormData(req.form);
      data.delete("_method");
      pending.set(true);
      handle?.setPending(true);
      const decoded = act.input.decodeStrings(data);
      let result: Result<Href | null, KeelError<string, unknown>>;
      if (!decoded.ok) result = err(fieldsError(act.input.node, decoded.error));
      else {
        const url = absoluteUrl(hrefIn(own, req.action, req.params, {}));
        const ran = await attempt(() => act.run(decoded.value, { params: req.params, url }, ctx));
        result = ran.ok ? ran.value : ran;
      }
      handle?.setPending(false);
      handle?.onResult(result);
      if (!result.ok) pending.set(false);
      else if (result.value === null) await revalidate();
      else await go(result.value, "push", 0);
      return result;
    },
  };

  const unsubscribe = history.onPop((url) => {
    void go(url, "pop", 0);
  });
  void go(history.current(), "initial", 0);

  return {
    navigate: (to, o) => go(to, o?.replace === true ? "replace" : "push", 0),
    route,
    App() {
      const frag = document.createDocumentFragment();
      const a = document.createComment("keel:router");
      frag.append(a);
      anchor = a;
      // The App's own scope is how `Form` finds this router (owner chain, `routers` WeakMap).
      scope(() => {
        const me = owner();
        if (me !== undefined) routers.set(me, core);
        if (typeof document !== "undefined") {
          const onClick = (e: MouseEvent): void => {
            const a = e.target instanceof Element ? e.target.closest("a[href]") : null;
            if (a === null || !(a instanceof HTMLAnchorElement) || !(anchor?.parentNode?.contains(a) ?? false)) return;
            if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            const t = a.getAttribute("target");
            if ((t !== null && t !== "" && t !== "_self") || a.hasAttribute("download")) return;
            const u = new URL(a.href, document.baseURI);
            if (u.origin !== new URL(document.baseURI).origin) return;
            e.preventDefault();
            void go(`${u.pathname}${u.search}${u.hash}`, "push", 0);
          };
          document.addEventListener("click", onClick);
          me?.onDispose(() => document.removeEventListener("click", onClick));
        }
        boundary(
          a,
          () => {
            const v = view.get();
            return v === null ? document.createComment("") : renderView(v, ctx);
          },
          (error, reset) => {
            resetRoot = reset;
            return defaultError(error);
          },
        );
      });
      return frag;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      token++;
      if (typeof unsubscribe === "function") unsubscribe();
      view.get()?.scope.dispose();
      root.scope.dispose();
    },
  };
}
