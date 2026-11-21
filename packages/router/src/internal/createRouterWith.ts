import type { Ctx } from "@keel/ctx";
import { report } from "@keel/ctx/internal";
import { batch, computed, owner, scope, signal } from "@keel/reactive";
import { boundary, list } from "@keel/runtime-dom/ops";
import { type KeelError, type Result, attempt, err, ok } from "@keel/schema";
import type { ServerState } from "@keel/store/internal";
import type { Href } from "../types/Href.ts";
import type { RouteTable } from "../types/RouteTable.ts";
import type { Router } from "../types/Router.ts";
import type { RouterHistory } from "../types/RouterHistory.ts";
import type { StateOf } from "../types/StateOf.ts";
import type { Verb } from "../types/Verb.ts";
import type { Located } from "./Located.ts";
import type { Match } from "./Match.ts";
import type { Place } from "./Place.ts";
import type { RouterCore } from "./RouterCore.ts";
import { STORES_SERVER_ONLY } from "./STORES_SERVER_ONLY.ts";
import type { View } from "./View.ts";
import { absoluteUrl } from "./absoluteUrl.ts";
import { afterNavigate } from "./afterNavigate.ts";
import { carriedParams } from "./carriedParams.ts";
import { codedError } from "./codedError.ts";
import { compileRoutes } from "./compileRoutes.ts";
import { defaultError } from "./defaultError.ts";
import { encodeHref } from "./encodeHref.ts";
import { fieldsError } from "./fieldsError.ts";
import { formHandle } from "./formHandle.ts";
import { guardLoop } from "./guardLoop.ts";
import { guardNext } from "./guardNext.ts";
import { isHref } from "./isHref.ts";
import { isRouteStateOf } from "./isRouteStateOf.ts";
import { matchUrl } from "./matchUrl.ts";
import { mounted } from "./mounted.ts";
import { needsBare } from "./needsBare.ts";
import { notFound } from "./notFound.ts";
import { pageHead } from "./pageHead.ts";
import { publicError } from "./publicError.ts";
import { renderView } from "./renderView.ts";
import { rooted } from "./rooted.ts";
import { routers } from "./routers.ts";
import { runGuard } from "./runGuard.ts";
import { runLoaders } from "./runLoaders.ts";
import { shells } from "./shells.ts";
import { splitUrl } from "./splitUrl.ts";
import { unexpected } from "./unexpected.ts";
import { withNext } from "./withNext.ts";
import { writeHead } from "./writeHead.ts";

type Nav = "push" | "replace" | "pop" | "initial" | "stay";
type Outcome = Result<unknown, KeelError<string, unknown>>;
type Failure = { readonly level: number; readonly bare: boolean; readonly error: KeelError<string, unknown> };

const MISSING: Place = { id: null, params: {}, search: {} };
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
 * then commit. The previous page stays rendered and `pending` is true until the commit. Guards, loaders and actions get
 * `caller` and `user` (default `""`; the harness supplies them). Each navigation that is not a guard's redirect reports `nav` to
 * the ctx's observers before its guards, and each loader or action `err` reports `error` (k.ctx Observers).
 * `state` runs loaders and actions naming `stores` (k.server Server state; the harness passes it, `createRouter` never
 * does): each loader run is one `state.request()` and each submit another, an action's `ok` saves (a stale read
 * becomes `keel.conflict`), and the request ends before the router revalidates or navigates. Without `state` such a
 * loader or action is `keel.unexpected`. Unless `mode` is `dev` (the default is `production`), every error the
 * default alert, an `errorElement` or a `Form` gets is its `publicError`; observers get the full error. A link click,
 * `navigate` or `ok(href)` to a path no page of the table matches (none matches at or under `mount`, nor a path
 * holding a `\`) is a document navigation (`leave`, k.mount); an initial load or a history pop of one renders the 404.
 * An action's `ok` value that is neither `null` nor an `Href` (`isHref`) is `keel.unexpected`, saved and followed
 * nowhere, given to the `Form` as any action `err`; `navigate` of a value that is no `Href` once each `\` reads as `/`
 * and any hash is dropped rejects with E1501 and nothing moves. On a shell's ctx (`mountRequests`, k.return) a
 * navigation under the identity mount is a mount request and nothing leaves.
 */
export function createRouterWith<T extends RouteTable>(
  routes: T,
  opts: {
    readonly ctx: Ctx;
    readonly history: RouterHistory;
    readonly caller?: string;
    readonly user?: string;
    readonly mode?: "dev" | "production";
    /** A document navigation (k.mount): `location.assign`, or `location.replace` with `replace`; the harness records it. */
    readonly leave?: (url: string, replace: boolean) => void;
    /** The identity mount's `path` (k.mount): no page matches at or under it. */
    readonly mount?: string | undefined;
  },
  state?: ServerState,
): Router<StateOf<T>> {
  const { ctx, history, leave = (u, r) => location[r ? "replace" : "assign"](u) } = opts;
  const mount = shells.get(ctx);
  const who = { caller: opts.caller ?? "", user: opts.user ?? "" };
  const shownMode = opts.mode === "dev" ? "dev" : "production";
  const shown = (e: KeelError<string, unknown>): KeelError<string, unknown> => publicError(e, shownMode);
  const { table: own, located } = compileRoutes(routes);
  // The client matches no API entry (k.api): a link to one is a document request.
  const table = located.filter((r) => r.def.kind === "page");
  const match = (url: string): Match => matchUrl(table, url, opts.mount);
  const root = rooted(() => {
    const view = signal<View | null>(null);
    const place = signal<Place>(MISSING);
    const pending = signal(false);
    const route = computed((): StateOf<T> => {
      const state = { ...place.get(), pending: pending.get() };
      if (isRouteStateOf<StateOf<T>>(own, state)) return state;
      throw new Error(`k.router: route id ${String(state.id)} is not in this route table`);
    });
    return { view, place, pending, route };
  });
  const { view, place, pending, route } = root.value;
  const scrolls = new Map<string, number>();
  let token = 0;
  let disposed = false;
  let entry: string | null = null;
  let popped: string | null = null;
  let keys = 0;
  let anchor: Node | null = null;
  let resetRoot: (() => void) | null = null;
  // The document's title when the router starts (a `client` deployable's `index.html` title): k.head's fallback.
  const fallbackTitle = typeof document === "undefined" ? "" : document.title;

  const makeView = (m: Match, results: readonly Outcome[], failure: Failure | null): View => {
    const chain = m.route?.chain ?? [];
    const params = m.kind === "route" ? m.params : {};
    const search = m.kind === "route" ? m.search : {};
    const last = results[chain.length - 1];
    const props = { params, search, data: last?.ok === true ? last.value : undefined };
    const head = pageHead(m.kind === "route" ? m.route : null, params, props, failure !== null);
    const made = rooted(() => ({
      data: chain.map((_, i) => signal(results[i]?.ok === true ? results[i].value : undefined)),
    }));
    return {
      url: m.url,
      chain,
      params,
      search,
      data: made.value.data,
      error: failure,
      scope: made.scope,
      head,
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

  const commit = (t: number, next: View, at: Place, mode: Nav): void => {
    if (t !== token || disposed) {
      next.scope.dispose();
      return;
    }
    const w = typeof window === "undefined" ? null : window;
    // Scroll is kept per history entry: save the entry being left, then key the arriving one.
    if (w !== null && entry !== null && mode !== "stay") scrolls.set(entry, w.scrollY);
    if (mode === "push") {
      entry = `k${++keys}`;
      history.push(next.url, entry);
    } else if (mode !== "stay") {
      const arrived = mode === "pop" ? popped : mode === "replace" ? entry : null;
      const stamp = arrived === null || history.current() !== next.url;
      entry = arrived ?? `k${++keys}`;
      if (stamp) history.replace(next.url, entry);
    }
    const prev = view.get();
    const kept = w !== null && prev?.chain === next.chain ? document.activeElement : undefined;
    batch(() => {
      view.set(next);
      place.set(at);
      pending.set(false);
    });
    prev?.scope.dispose();
    writeHead(next.head, fallbackTitle);
    const reset = resetRoot;
    resetRoot = null;
    reset?.();
    if (mode === "push" || mode === "replace") afterNavigate(anchor?.parentNode ?? null, next.url, kept, prev?.url);
    else if (mode === "pop" && w !== null) w.scrollTo(0, scrolls.get(entry ?? "") ?? 0);
  };

  // A denial's location carries `next` (never nested) and is E1508 when it revisits `visited` or is the ninth.
  const redirectTo = (
    id: string,
    url: string,
    params: Readonly<Record<string, unknown>>,
    visited: readonly string[],
  ): Result<string, KeelError<string, unknown>> => {
    const carried = carriedParams(id, own.get(id)?.def, params);
    if (!carried.ok) return err(unexpected(carried.error));
    const r = attempt(() => encodeHref(id, own.get(id)?.def, carried.value, {}));
    if (!r.ok) return err(unexpected(`guard redirect to "${id}" failed: ${r.error.message}`));
    const to = withNext(String(r.value), guardNext(table, url));
    const loop = guardLoop(visited, to);
    return loop === null ? ok(to) : err(unexpected(`E1508 ${loop}`));
  };

  const proceed = async (
    t: number,
    m: Match & { kind: "route" },
    mode: Nav,
    visited: readonly string[],
  ): Promise<void> => {
    for (const [i, lvl] of m.route.chain.entries()) {
      const g = lvl.def.guard;
      if (g === undefined) continue;
      const r = await runGuard(g, m.url, ctx, who);
      if (t !== token) return;
      if (r.ok) continue;
      if (r.error.code !== "keel.denied") return commit(t, failedAt(m, i, r.error), placeOf(m), mode);
      const to = redirectTo(g.redirect ?? "", m.url, m.params, [...visited, m.url]);
      if (!to.ok) return commit(t, failedAt(m, i, to.error), placeOf(m), mode);
      return go(to.value, mode === "push" ? "push" : "replace", [...visited, m.url]);
    }
    const results = await runLoaders(
      m.route.chain,
      { params: m.params, search: m.search, url: absoluteUrl(m.url), ...who },
      ctx,
      state,
    );
    if (t !== token) return;
    commit(t, loaded(m, results), placeOf(m), mode);
  };

  const go = (url: string, mode: Nav, visited: readonly string[]): Promise<void> => {
    if (disposed) return done;
    const m = match(url);
    // A path no page of the table matches is the server's: a link, `navigate` or `ok` there loads a document.
    if (m.route === null && (mode === "push" || mode === "replace")) {
      pending.set(false);
      if (!mount?.(url)) leave(url, mode === "replace");
      return done;
    }
    const t = ++token;
    if (m.kind === "notFound") {
      commit(t, failedAt(m, Number.MAX_SAFE_INTEGER, notFound(m.url)), MISSING, mode);
      return done;
    }
    const { id, def } = m.route;
    if (visited.length === 0)
      report(ctx, {
        kind: "nav",
        href: m.url,
        route: {
          id,
          path: def.path ?? "",
          params: m.params,
          search: m.search,
          schemas: { params: def.params, search: def.search },
        },
      });
    if (view.get() === null) place.set(placeOf(m));
    if (m.route.chain.every((l) => l.def.guard === undefined && l.def.loader === undefined)) {
      commit(t, loaded(m, []), placeOf(m), mode);
      return done;
    }
    pending.set(true);
    return proceed(t, m, mode, visited);
  };

  const revalidate = async (): Promise<void> => {
    const v = view.get();
    const m = v === null ? null : match(v.url);
    if (v === null || m === null || m.kind !== "route") return;
    const t = token;
    pending.set(true);
    const results = await runLoaders(
      v.chain,
      { params: v.params, search: v.search, url: absoluteUrl(v.url), ...who },
      ctx,
      state,
    );
    if (t !== token || disposed || view.get() !== v) return;
    if (v.error !== null || results.some((r) => !r.ok)) return commit(t, loaded(m, results), placeOf(m), "stay");
    batch(() => {
      for (const [i, r] of results.entries()) if (r.ok) v.data[i]?.set(r.value);
      pending.set(false);
    });
  };

  // A Form's `action` is an Href: its route and params come from matching it in this router's table.
  const actionAt = (href: Href, method: Verb) => {
    const m = match(href);
    const act = m.kind === "route" ? m.route.def.actions[method] : undefined;
    // The client router posts to pages only, whose actions declare no `output` (k.api).
    return m.kind === "route" && act !== undefined && act.output === undefined ? { act, params: m.params } : null;
  };
  // An `Href` is a type; a value that slipped past it at run time is E1501 and goes nowhere unless it is an `Href` once
  // each `\` reads as `/` (as a URL parser reads it) and any hash is dropped: such a path stays on the origin, and one
  // no page matches (a raw `\`, k.mount-scope) is a document navigation there.
  const navigate = (to: Href, o?: { readonly replace?: boolean }): Promise<void> =>
    typeof to === "string" && isHref(to.replaceAll("\\", "/").replace(/#.*$/s, ""))
      ? go(to, o?.replace === true ? "replace" : "push", [])
      : Promise.reject(codedError("E1501", "navigate: the value is no Href, a path of this origin"));
  const core: RouterCore = {
    ctx,
    navigate,
    accepts: (href, method) => (match(href).route === null ? null : actionAt(href, method) !== null),
    async submit(req) {
      const handle = req.handle?.[formHandle];
      if (handle !== undefined && !handle.validate().ok) return null;
      const target = actionAt(req.action, req.method);
      if (target === null || disposed) return null;
      const { act, params } = target;
      const data = new FormData(req.form);
      data.delete("_method");
      pending.set(true);
      handle?.setPending(true);
      const decoded = act.input.decodeStrings(data);
      let result: Result<Href | null, KeelError<string, unknown>>;
      if (!decoded.ok) result = err(fieldsError(act.input.node, decoded.error));
      else if (act.stores !== undefined && state === undefined) result = err(unexpected(STORES_SERVER_ONLY));
      else {
        const url = absoluteUrl(req.action);
        // One request: the action's instance, its `ok` saved (else `keel.conflict`), ended before revalidating.
        const rq = state?.request();
        const from = act.stores;
        const ran = await attempt(async () => {
          const stores = from === undefined ? undefined : await rq?.stores(from);
          const out = await act.run(decoded.value, { params, url, ...who, stores }, ctx);
          // A link that is no `Href` is never followed: `keel.unexpected`, nothing saved, the value in no message.
          if (out.ok && out.value !== null && (typeof out.value !== "string" || !isHref(out.value)))
            return err(unexpected(`action ${String(req.action)} returned a link that is no path of this origin`));
          const clash = out.ok ? await rq?.save() : null;
          return clash ? err(clash) : out;
        });
        rq?.end();
        result = ran.ok ? ran.value : ran;
        if (!result.ok) report(ctx, { kind: "error", error: result.error });
      }
      if (!result.ok) result = err(shown(result.error));
      handle?.setPending(false);
      handle?.onResult(result);
      if (!result.ok) pending.set(false);
      else if (result.value === null) await revalidate();
      else await go(result.value, "push", []);
      return result;
    },
  };

  const unsubscribe = history.onPop((url, key) => {
    popped = key ?? null;
    void go(url, "pop", []);
  });
  void go(history.current(), "initial", []);

  return {
    navigate,
    route,
    App() {
      const frag = document.createDocumentFragment();
      const a = document.createComment("keel:router");
      frag.append(a);
      anchor = a;
      // The App's own scope is how `Form` finds this router (owner chain, `routers` WeakMap).
      scope(() => {
        const me = owner();
        if (me !== undefined) {
          routers.set(me, core);
          mounted.push(core);
          me.onDispose(() => {
            const i = mounted.indexOf(core);
            if (i >= 0) mounted.splice(i, 1);
          });
        }
        if (typeof document !== "undefined") {
          const onClick = (e: MouseEvent): void => {
            const a = e.target instanceof Element ? e.target.closest("a[href]") : null;
            if (a === null || !(a instanceof HTMLAnchorElement) || !(anchor?.parentNode?.contains(a) ?? false)) return;
            if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            const t = a.getAttribute("target");
            if ((t !== null && t !== "" && t !== "_self") || a.hasAttribute("download")) return;
            const u = new URL(a.href, document.baseURI);
            // A path the table has no page for (an API route, the identity mount) is the browser's to follow.
            if (u.origin !== new URL(document.baseURI).origin || match(u.pathname).route === null) return;
            e.preventDefault();
            void go(`${u.pathname}${u.search}${u.hash}`, "push", []);
          };
          document.addEventListener("click", onClick);
          me?.onDispose(() => document.removeEventListener("click", onClick));
        }
        boundary(
          a,
          () => {
            // The committed page is a row keyed by its path: a navigation that changes only the search or hash keeps
            // the page under the new view; revalidation keeps the view; anything else renders anew.
            const f = document.createDocumentFragment();
            const at = document.createComment("");
            f.append(at);
            list(
              at,
              () => {
                const v = view.get();
                return v === null ? [] : [v];
              },
              // A page that rendered keeps its row across navigations to its path: only the search or hash differs.
              (v) => (v.error === null ? splitUrl(v.url).path : v),
              (v) => renderView(v, ctx, shown),
            );
            return f;
          },
          (error, reset) => {
            resetRoot = reset;
            return defaultError(shown(error));
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
