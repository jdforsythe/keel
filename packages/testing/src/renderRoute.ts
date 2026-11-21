import { type Ctx, createCtx } from "@keel/ctx";
import type { RouteTable } from "@keel/router";
import { compileRoutes, createRouterWith, encodeHref, identityMounts, mountRequests } from "@keel/router/internal";
import { matchHref } from "@keel/router/match";
import type { CaughtError } from "@keel/runtime-dom";
import { serverState } from "@keel/store/internal";
import { fail } from "./internal/fail.ts";
import { memoryHistory } from "./internal/memoryHistory.ts";
import { openHarness } from "./internal/openHarness.ts";
import { seedFrom } from "./internal/seedFrom.ts";
import { seedStores } from "./internal/seedStores.ts";
import { settle } from "./internal/settle.ts";
import type { DocumentNavigation } from "./types/DocumentNavigation.ts";
import type { RouteHarness } from "./types/RouteHarness.ts";
import type { RouteRenderOptions } from "./types/RouteRenderOptions.ts";
import type { RouteStateOf } from "./types/RouteStateOf.ts";

/**
 * Render page `id` of route table `options.routes` (a manifest or `routeTable`; an id of no page, an API entry or a
 * layout, rejects with E1501) (k.testing Harness): seed `state`, create a router on an in-memory history at `url` (a
 * root-relative path and query matching page `id`, else E1501), else page `id`'s href of `params` and `search`; scroll goes to the top at open and at dispose (its initial navigation runs the
 * chain's guards and loaders), mount its `App`, and resolve once no navigation is pending and the DOM is quiet; then
 * the render checks run (`keel.unexpected`, a render throw no `errorElement` caught included, then k.a11y's: E1702, E1703 with the document rules, E1804, E1821). The
 * page is a document: the chain is its `main` landmark unless it renders one, the router writes `<title>` and
 * `<html lang>` (k.head), and a document without a title takes the route id as the server's fallback title. The
 * handle is `render`'s plus `route()`, `navigate(href)` (push, then the same quiescence and checks as `fire`) and
 * `location()` (`{ entries, scrollY }`: the history length and the scroll position) and `documents()` (k.mount Testing:
 * the document navigations the page started, in order, recorded and not made, so the page stays). With
 * `options.shell` the page runs as in a native shell (k.return Testing): a navigation under the identity mount is a
 * mount request through `ctx.net`, `documents()` records each URL opened in the external browser as a GET, and
 * `returnLink(url)` delivers a return link on the shell's `id` (`dev.keel.golden2` for `true`), the shell reports a
 * launch with no link before the first render unless `options.launch` is `'later'`, which leaves it to the handle's
 * `launch(links)` (k.links Testing), and a `fire` of `click`, `submit` or a `keydown` other than Escape is a person's
 * act (k.opening Link-started), which the handle's `navigate` is not;
 * `dispose` also disposes the router and puts the title and `lang` back. Guards, loaders and actions get
 * `options.caller` and `options.user` (each default `""`). Loaders and actions naming `stores` run their factories over `ctx.storage` as a
 * `node` deployable does (`serverState`, k.server Server state), each navigation or submit one request; `state` and
 * `state()` hold no factory store. The handle's `ctx` is typed as `render`'s: `SimCtx` when none is given.
 */
export function renderRoute<T extends RouteTable>(
  id: string,
  options: RouteRenderOptions<T> & { readonly ctx?: undefined },
): Promise<RouteHarness<RouteStateOf<T>>>;
export function renderRoute<T extends RouteTable, C extends Ctx>(
  id: string,
  options: RouteRenderOptions<T> & { readonly ctx: C },
): Promise<RouteHarness<RouteStateOf<T>, C>>;
export function renderRoute<T extends RouteTable>(
  id: string,
  options: RouteRenderOptions<T>,
): Promise<RouteHarness<RouteStateOf<T>, Ctx>>;
export async function renderRoute<T extends RouteTable>(
  id: string,
  options: RouteRenderOptions<T>,
): Promise<RouteHarness<RouteStateOf<T>, Ctx>> {
  const routes: RouteTable = options.routes;
  const raw = options.url;
  // A raw url is a root-relative path and query of page `id` (never another origin, scheme or route).
  if (raw !== undefined && (!/^\/(?![/\\])/.test(raw) || matchHref(routes, raw)?.id !== id))
    throw fail("E1501", `renderRoute(${JSON.stringify(id)}): url ${JSON.stringify(raw)} is not a path of this page`, {
      url: raw,
    });
  const url =
    raw ?? encodeHref(id, compileRoutes(routes).table.get(id)?.def, options.params ?? {}, options.search ?? {});
  // Each harness starts at the top: scroll is the window's, shared with the test before.
  window.scrollTo(0, 0);
  const seeded = seedStores(options.state ?? []);
  // The document a server writes always has a title (the deployable's name, k.head); the harness's fallback is the id.
  const head = { title: document.title, lang: document.documentElement.getAttribute("lang") };
  if (document.title === "") document.title = id;
  const restoreHead = (): void => {
    document.title = head.title;
    if (head.lang === null) document.documentElement.removeAttribute("lang");
    else document.documentElement.setAttribute("lang", head.lang);
  };
  const ctx = options.ctx ?? createCtx({ mode: "sim", seed: seedFrom(undefined) });
  let router: ReturnType<typeof createRouterWith<T>>;
  // A render throw no errorElement caught: the router's root alert shows it, and the checks raise it.
  const caught: CaughtError[] = [];
  const history = memoryHistory(url);
  const documents: DocumentNavigation[] = [];
  const open = (to: string): void => void documents.push({ method: "GET", url: to, body: null });
  const { shell } = options;
  // The options name no mount: a shell run takes every identity mount the test's modules made.
  const mounts = [...identityMounts];
  const intake = shell
    ? mountRequests(ctx, { id: shell === true ? "dev.keel.golden2" : shell.id, open, mounts })
    : null;
  if (options.launch === undefined) void intake?.launch([]);
  try {
    router = createRouterWith(
      options.routes,
      {
        ctx,
        history,
        caller: options.caller ?? "",
        user: options.user ?? "",
        leave: open,
        mount: options.mount,
        onError: (error) => void caught.push(error),
      },
      serverState(ctx),
    );
  } catch (error) {
    for (const [st, snap] of seeded) st.restore(snap);
    restoreHead();
    throw error;
  }
  const busy = (): string | null => {
    const r = router.route.get();
    return r.pending ? String(r.id) : null;
  };
  const { harness, check } = openHarness({
    view: () => router.App(),
    ctx,
    seeded,
    busy,
    documents,
    caught,
    page: true,
    target: () => ({ route: String(router.route.get().id), component: null }),
    teardown: () => {
      router.dispose();
      restoreHead();
      window.scrollTo(0, 0);
    },
    artifacts: options.artifacts,
  });
  try {
    await settle(document.body, () => undefined, busy);
    check();
  } catch (error) {
    harness.dispose();
    throw error;
  }
  return {
    ...harness,
    // Under a shell, a fire that stands for a person's act marks it on the ctx before the event is dispatched.
    fire: (id, event) => {
      intake?.fired(event);
      return harness.fire(id, event);
    },
    route: () => router.route.get(),
    navigate: async (href) => {
      void router.navigate(href);
      await harness.settle();
    },
    location: () => ({ entries: history.length(), scrollY: window.scrollY }),
    documents: () => [...documents],
    returnLink: async (url) => {
      await intake?.link(url);
      await harness.settle();
    },
    launch: async (links) => {
      await intake?.launch(links);
      await harness.settle();
    },
  };
}
