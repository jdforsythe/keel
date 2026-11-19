import type { Ctx, FireEvent } from "@keel/ctx";
import { absoluteUrl } from "./absoluteUrl.ts";
import { findRouter } from "./findRouter.ts";
import { formSeams } from "./formSeams.ts";
import { isHref } from "./isHref.ts";
import { mountLinks } from "./mountLinks.ts";
import { mountPaths } from "./mountPaths.ts";
import { personActs } from "./personActs.ts";
import { returnOpenings } from "./returnOpenings.ts";
import { shells } from "./shells.ts";

/** What a shell gives `mountRequests`. */
type Shell = {
  /** The shell's `id` (k.shell): the scheme of its return links. */
  readonly id: string;
  /** Opens a URL in the external browser: absolute, or root-relative for one on `KEEL_ORIGIN`. */
  readonly open: (url: string) => void;
  /** Closes the external browser when the platform has one to close (the in-app Safari view). */
  readonly close?: (() => void) | undefined;
  /** The build's `KEEL_ORIGIN`, so a redirect that names it in full is read as one to its path. */
  readonly origin?: string | undefined;
};

/**
 * A chain (k.opening Chains): a mount request and each redirect followed after it. `from` is who started it, the page
 * (a `Link` click, `navigate`, `ok(href)`, a `Form`) or a delivered return link (a declared path's, or one that took an
 * opening); only a page's chain records an opening. `redirects` counts the redirects followed in a row, on `KEEL_ORIGIN` or to the shell's own scheme. Each
 * request gets its own value, so concurrent chains share nothing.
 */
type Chain = { readonly from: "page" | "link"; readonly redirects: number };

/** Redirects in a row that are followed; the next one sends nothing. */
const MAX_REDIRECTS = 5;
/** The start of a chain the page starts, and of one a return link starts. */
const PAGE: Chain = { from: "page", redirects: 0 };
const LINK: Chain = { from: "link", redirects: 0 };
const agents = new WeakMap<Ctx, Shell>();
/** The ctxs whose shell has reported its launch (k.links Launch). */
const reported = new WeakSet<Ctx>();
/** Per ctx, until its launch report: when the last held opening opened, on `ctx.clock`. */
const held = new WeakMap<Ctx, number>();
let listening = false;

const under = (pathname: string): boolean => {
  for (const p of mountPaths) if (pathname === p || pathname.startsWith(`${p}/`)) return true;
  return false;
};
/** The router rendering on `ctx`, when it is the one mounted. */
const routerOf = (ctx: Ctx) => {
  const core = findRouter();
  return core?.ctx === ctx ? core : null;
};
/** The base a root-relative path is read against, and a second one: a path that names a host has it against both. */
const BASE = "http://keel.invalid";
const ALT = "http://alt.invalid";
const parsed = (url: string, base: string): URL | null => (URL.canParse(url, base) ? new URL(url, base) : null);

/**
 * A root-relative `path` (with search and hash) as its pathname and its `href` (pathname and search); null when it
 * does not parse, when a URL parser reads it as naming a host (it begins `//` or `/\`, also past tabs and newlines),
 * and when its path begins `//` once dot segments are removed.
 */
const split = (path: string): { pathname: string; href: string } | null => {
  const u = parsed(path, BASE);
  return u === null || u.origin !== BASE || parsed(path, ALT)?.origin !== ALT || u.pathname.startsWith("//")
    ? null
    : { pathname: u.pathname, href: `${u.pathname}${u.search}` };
};

/** The client-side navigation to `href` when the router rendering on `ctx` has a page there; null when it has none. */
const page = (ctx: Ctx, href: string): Promise<void> | null => {
  const core = routerOf(ctx);
  return isHref(href) && core !== null && core.accepts(href, "POST") !== null ? core.navigate(href) : null;
};

/**
 * Where a root-relative `path` (with search and hash) on `KEEL_ORIGIN` goes, as part of `chain`: a page, a mount
 * request GET while the chain has followed no more than 5 redirects in a row, or `elsewhere`.
 */
async function arrive(
  ctx: Ctx,
  shell: Shell,
  path: string,
  chain: Chain,
  elsewhere: () => void | Promise<void>,
): Promise<void> {
  const at = split(path);
  if (at === null) return;
  const { pathname, href } = at;
  const to = page(ctx, href);
  if (to !== null) return to;
  if (!under(pathname)) return elsewhere();
  if (chain.redirects <= MAX_REDIRECTS) await request(ctx, shell, href, chain);
}

/**
 * A mount request of `chain` opens `url` in the external browser. A chain the page started records an opening first
 * (k.opening Chains) unless the ctx is link-started (`personActs`), read now as the browser opens, not when the chain
 * started; before the shell reports its launch with no person's act since the ctx started, the opening is held
 * instead (k.links Launch): nothing is stored, and the report decides. A chain a return link started records none.
 * The browser opens either way, also when the opening cannot be stored.
 */
async function opening(ctx: Ctx, shell: Shell, url: string, chain: Chain): Promise<void> {
  const acts = personActs.of(ctx);
  if (chain.from === "page" && !acts.linked) {
    if (!acts.acted && !reported.has(ctx)) held.set(ctx, ctx.clock.now());
    else {
      held.delete(ctx);
      await returnOpenings.record(ctx);
    }
  }
  shell.open(url);
}

/**
 * One mount request (k.return): `href` through `ctx.net` with `x-keel: 1`, `accept: application/json` and
 * `redirect: 'manual'`, a POST of `body` (urlencoded) when given, else a GET. Only the answer's status and `location`
 * are read. A redirect on `KEEL_ORIGIN` goes where `arrive` says, one elsewhere opens in the external browser when
 * it is `http:` or `https:`, and one on the shell's own scheme is read as a return link that takes no opening and
 * continues `chain`, counting toward its redirects in a row. A location whose path begins `//` or `/\` once dot
 * segments are removed is ignored (`split`). A GET answered without a redirect opens its URL in the
 * external browser, recorded or held as `opening` says.
 * A POST answered without a redirect, and a request that fails, change nothing.
 */
async function request(ctx: Ctx, shell: Shell, href: string, chain: Chain, body?: string): Promise<void> {
  const headers: Record<string, string> = { "x-keel": "1", accept: "application/json" };
  if (body !== undefined) headers["content-type"] = "application/x-www-form-urlencoded";
  const req = new Request(absoluteUrl(href), {
    method: body === undefined ? "GET" : "POST",
    headers,
    redirect: "manual",
    ...(body === undefined ? {} : { body }),
  });
  let res: Response;
  try {
    res = await ctx.net.fetch(req);
  } catch {
    return;
  }
  // The body is never read: its stream is released.
  void res.body?.cancel().catch(() => undefined);
  const to = res.status >= 300 && res.status < 400 ? res.headers.get("location") : null;
  if (to === null) {
    if (body === undefined) await opening(ctx, shell, href, chain);
    return;
  }
  const home = shell.origin ?? new URL(req.url).origin;
  const t = parsed(to, new URL(href, home).href);
  // A relative location `split` refuses (`//host`, `/\host`, `/.//host`) is ignored.
  if (t === null || (!URL.canParse(to) && split(to) === null)) return;
  const next: Chain = { from: chain.from, redirects: chain.redirects + 1 };
  if (t.protocol === `${shell.id}:`) {
    const rest = returnPath(shell, t.href);
    return rest === null ? undefined : arrive(ctx, shell, rest.href, next, () => undefined);
  }
  const path = `${t.pathname}${t.search}${t.hash}`;
  if (t.origin === home) return arrive(ctx, shell, path, next, () => opening(ctx, shell, path, chain));
  if (t.protocol === "https:" || t.protocol === "http:") await opening(ctx, shell, t.href, chain);
}

/**
 * The path of a return link `<id>:/<path>?<search>`, its scheme in any case, as `split` gives it; null for any other
 * URL and for a path `split` refuses.
 */
function returnPath(shell: Shell, url: string): ReturnType<typeof split> {
  const scheme = `${shell.id}:`;
  const rest = url.slice(scheme.length);
  return url.slice(0, scheme.length).toLowerCase() === scheme.toLowerCase() && rest[0] === "/" ? split(rest) : null;
}

/**
 * The intake of return links (k.links Return links), every one the platform delivers, at launch or while running,
 * sorted by its path. A page the router matches: a client-side navigation there. The mount's path plus a declared
 * link (`mountLinks`), exactly: a mount request GET. Any other path under the mount first takes the pending opening
 * (`returnOpenings.take`, one `commit`), then closes the external browser and is a mount request GET; with none taken
 * it is ignored. Any other URL or path is ignored. A link taken any of these ways makes the ctx link-started
 * (`personActs`) before anything else happens, and its GET starts a chain that records no opening.
 */
async function link(ctx: Ctx, shell: Shell, url: string): Promise<void> {
  const at = returnPath(shell, url);
  if (at === null) return;
  const { pathname, href } = at;
  const acts = personActs.of(ctx);
  const was = acts.linked;
  acts.linked = true;
  const to = page(ctx, href);
  if (to !== null) return to;
  if (!mountLinks.has(pathname)) {
    acts.linked = was;
    if (!under(pathname) || !(await returnOpenings.take(ctx))) return;
    acts.linked = true;
    shell.close?.();
  }
  await request(ctx, shell, href, LINK);
}

/**
 * The shell's launch report (k.links Launch), once per ctx; a later one is ignored. `links` are the return links the
 * app was launched with, `[]` for an ordinary launch, `null` when the shell could not read them. A report of no link
 * records the held opening as of when it opened. Any other report drops it and makes the ctx link-started until a
 * person acts, whether or not a link is taken, so a mount request in flight records no opening; then it delivers the
 * links in order.
 */
async function launch(ctx: Ctx, shell: Shell, links: readonly string[] | null): Promise<void> {
  if (reported.has(ctx)) return;
  reported.add(ctx);
  const at = held.get(ctx);
  held.delete(ctx);
  if (links?.length !== 0) personActs.of(ctx).linked = true;
  else if (at !== undefined) await returnOpenings.record(ctx, at);
  for (const url of links ?? []) await link(ctx, shell, url);
}

/** The mounted router's ctx and its shell, when a `Link` click or a `Form` post there is the shell's to take. */
function taking(e: Event, url: string): { ctx: Ctx; shell: Shell; href: string } | null {
  const ctx = findRouter()?.ctx;
  const shell = ctx === undefined ? undefined : agents.get(ctx);
  const u = parsed(url, document.baseURI);
  if (e.defaultPrevented || ctx === undefined || shell === undefined || u === null) return null;
  if (u.origin !== new URL(document.baseURI).origin || !under(u.pathname)) return null;
  return { ctx, shell, href: `${u.pathname}${u.search}` };
}

/** After every handler of the page, as the browser's default action runs: a click in a link, a form's submit. */
function listen(): void {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener("click", (e) => {
    const a = e.target instanceof Element ? e.target.closest("a[href]") : null;
    if (!(a instanceof HTMLAnchorElement) || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const target = a.getAttribute("target");
    if ((target !== null && target !== "" && target !== "_self") || a.hasAttribute("download")) return;
    const mine = taking(e, a.href);
    if (mine === null) return;
    e.preventDefault();
    void request(mine.ctx, mine.shell, mine.href, PAGE);
  });
  window.addEventListener("submit", (e) => {
    const form = e.target;
    if (!(form instanceof HTMLFormElement) || form.method !== "post") return;
    const mine = taking(e, form.action);
    if (mine === null) return;
    e.preventDefault();
    const by = e.submitter;
    const data = new FormData(form, by instanceof HTMLButtonElement || by instanceof HTMLInputElement ? by : null);
    const body = new URLSearchParams();
    for (const [k, v] of data) body.append(k, typeof v === "string" ? v : v.name);
    const seam = formSeams.get(form);
    seam?.setPending(true);
    void request(mine.ctx, mine.shell, mine.href, PAGE, body.toString()).then(() => seam?.setPending(false));
  });
}

/**
 * Makes `ctx` a shell's for the identity mount (k.return): from then on, on a router of that ctx, each document
 * navigation to a path under an `identityMount` (a `Link` click, `navigate`, an action's `ok(href)`, a `Form` the
 * browser would post) is a mount request through `ctx.net` (`request`) and nothing leaves the page. Returns the
 * shell's inputs: `link`, the intake of return links (k.links), and `launch`, the launch report, each resolving when
 * its work is done; and `fired`, a test harness's `fire` (`personActs.fired`). Each opening of the external browser
 * by a chain the page started is recorded, held until the launch report, or not recorded while the ctx is
 * link-started (`opening`; acts watched from here on); one by a chain a return link started is not. Calling it again
 * for a ctx replaces its shell.
 */
export function mountRequests(
  ctx: Ctx,
  shell: Shell,
): {
  readonly link: (url: string) => Promise<void>;
  readonly launch: (links: readonly string[] | null) => Promise<void>;
  readonly fired: (e: FireEvent) => void;
} {
  agents.set(ctx, shell);
  personActs.watch(ctx);
  shells.set(ctx, (url) => {
    const u = parsed(url, BASE);
    if (u === null || !under(u.pathname)) return false;
    void request(ctx, shell, `${u.pathname}${u.search}`, PAGE);
    return true;
  });
  listen();
  return {
    link: (url) => link(ctx, shell, url),
    launch: (links) => launch(ctx, shell, links),
    fired: (e) => personActs.fired(ctx, e),
  };
}
