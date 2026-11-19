import type { Ctx } from "@keel/ctx";
import { absoluteUrl } from "./absoluteUrl.ts";
import { findRouter } from "./findRouter.ts";
import { formSeams } from "./formSeams.ts";
import { isHref } from "./isHref.ts";
import { mountPaths } from "./mountPaths.ts";
import { shells } from "./shells.ts";

/** What a shell gives `mountRequests`. */
type Shell = {
  /** The shell's `id` (k.shell): the scheme of its return links. */
  readonly id: string;
  /** Opens a URL in the external browser: absolute, or root-relative for one on `KEEL_ORIGIN`. */
  readonly open: (url: string) => void;
  /** The build's `KEEL_ORIGIN`, so a redirect that names it in full is read as one to its path. */
  readonly origin?: string | undefined;
};

/** Redirects in a row under the mount that are followed; the next one sends nothing. */
const MAX_REDIRECTS = 5;
const agents = new WeakMap<Ctx, Shell>();
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
const parsed = (url: string, base: string): URL | null => (URL.canParse(url, base) ? new URL(url, base) : null);

/** Where a root-relative `path` (with search and hash) on `KEEL_ORIGIN` goes: a mount request, a page, or nowhere. */
async function arrive(ctx: Ctx, shell: Shell, path: string, redirects: number, elsewhere: () => void): Promise<void> {
  const u = new URL(path, "http://keel.invalid");
  const href = `${u.pathname}${u.search}`;
  const core = routerOf(ctx);
  if (isHref(href) && core !== null && core.accepts(href, "POST") !== null) return core.navigate(href);
  if (!under(u.pathname)) return elsewhere();
  if (redirects <= MAX_REDIRECTS) await request(ctx, shell, href, undefined, redirects);
}

/**
 * One mount request (k.return): `href` through `ctx.net` with `x-keel: 1`, `accept: application/json` and
 * `redirect: 'manual'`, a POST of `body` (urlencoded) when given, else a GET. Only the answer's status and `location`
 * are read. A redirect on `KEEL_ORIGIN` goes where `arrive` says, one elsewhere opens in the external browser when
 * it is `http:` or `https:`, and one on the shell's own scheme is read as a return link. A GET answered without a
 * redirect opens its URL in the external browser; a POST answered without one, and a request that fails, change
 * nothing.
 */
async function request(ctx: Ctx, shell: Shell, href: string, body?: string, redirects = 0): Promise<void> {
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
    if (body === undefined) shell.open(href);
    return;
  }
  const home = shell.origin ?? new URL(req.url).origin;
  const t = parsed(to, new URL(href, home).href);
  if (t === null) return;
  if (t.protocol === `${shell.id}:`) return link(ctx, shell, t.href);
  const path = `${t.pathname}${t.search}${t.hash}`;
  if (t.origin === home) return arrive(ctx, shell, path, redirects + 1, () => shell.open(path));
  if (t.protocol === "https:" || t.protocol === "http:") shell.open(t.href);
}

/** A return link `<id>:/<path>?<search>` (k.return Return links): read as a redirect to that path; anything else is ignored. */
async function link(ctx: Ctx, shell: Shell, url: string): Promise<void> {
  const scheme = `${shell.id}:`;
  const rest = url.slice(scheme.length);
  if (url.slice(0, scheme.length).toLowerCase() !== scheme.toLowerCase() || !/^\/(?![/\\])/.test(rest)) return;
  await arrive(ctx, shell, rest, 0, () => undefined);
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
    void request(mine.ctx, mine.shell, mine.href);
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
    void request(mine.ctx, mine.shell, mine.href, body.toString()).then(() => seam?.setPending(false));
  });
}

/**
 * Makes `ctx` a shell's for the identity mount (k.return): from then on, on a router of that ctx, each document
 * navigation to a path under an `identityMount` (a `Link` click, `navigate`, an action's `ok(href)`, a `Form` the
 * browser would post) is a mount request through `ctx.net` (`request`) and nothing leaves the page. Returns the intake
 * of return links: given `<id>:/<path>?<search>` it sends a mount request GET for a path under the mount, navigates to
 * a page, and ignores anything else; it resolves when that is done. Calling it again for a ctx replaces its shell.
 */
export function mountRequests(ctx: Ctx, shell: Shell): (url: string) => Promise<void> {
  agents.set(ctx, shell);
  shells.set(ctx, (url) => {
    const u = parsed(url, "http://keel.invalid");
    if (u === null || !under(u.pathname)) return false;
    void request(ctx, shell, `${u.pathname}${u.search}`);
    return true;
  });
  listen();
  return (url) => link(ctx, shell, url);
}
