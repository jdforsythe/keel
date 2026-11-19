// Fixtures for the k.return suites (not a test file). Seed for every property: 1337.
// A shell run of the k.mount pages: `renderRoute(id, { routes, ctx, shell: true })` over a sim ctx whose net answers every URL through `answer`.
// Assumptions (the spec does not say): `shell: true` is a `renderRoute` option beside `ctx`; the sim net sees the mount request as a `Request` whose URL
// resolves (against the page's origin, whatever it is) to the `href` unchanged, so a request is recorded as pathname + search;
// the shell's `id` for `returnLink` is `dev.keel.golden2` (the spec's example), supplied by the harness; `returnLink(url)` returns a promise or nothing (awaited either way).
import { createCtx } from "@keel/ctx";
import type { SimCtx } from "@keel/ctx";
import { renderRoute } from "@keel/testing";
import { routes } from "./mount-pages.ts";

export { SEED, VALID, INVALID, mount } from "./mount-pages.ts";
export const SCHEME = "dev.keel.golden2";

/** One request the page made through the sim `net`. */
export interface Sent {
  readonly method: string;
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly redirect: string;
  readonly body: string;
}
export type Answer = (sent: Sent, index: number) => Response | Promise<Response>;

export const redirect = (status: number, location: string): Response =>
  new Response(null, { status, headers: { location } });
export const plain = (): Response => new Response("ok", { status: 200 });

const opened: { dispose(): void }[] = [];

/** A shell render of `id`; `sent` fills with each `net` request; `answer` decides each response (default 200). */
export async function openShell(id: string, answer: Answer = plain, given?: SimCtx) {
  const ctx = given ?? createCtx({ mode: "sim", seed: 1337 });
  const sent: Sent[] = [];
  ctx.net.route("*", async (req) => {
    const u = new URL(req.url, "http://localhost");
    const headers: Record<string, string> = {};
    req.headers.forEach((v, k) => {
      headers[k.toLowerCase()] = v;
    });
    const entry: Sent = {
      method: req.method,
      url: u.pathname + u.search,
      headers,
      redirect: req.redirect,
      body: req.method === "GET" ? "" : await req.text(),
    };
    sent.push(entry);
    return answer(entry, sent.length - 1);
  });
  const handle = await renderRoute(id, { routes, ctx, shell: true });
  opened.push(handle);
  return { handle, sent, ctx };
}

export function closeAll(): void {
  for (const h of opened.splice(0)) h.dispose();
}

export async function ticks(): Promise<void> {
  for (let i = 0; i < 60; i++) await Promise.resolve();
}

/** The first request of a click on the home page's `Link` to `mount.href('/login/github', { next: 'a b' })`. */
export const START = "/api/auth/login/github?next=a%20b";
export const PROVIDER = "https://provider.example/a";

/** An answer that opens the external browser on the start request and answers every return-link GET with a 303 to the home page (no opening, no external open). */
export const sessionAnswer: Answer = (s) => (s.url === START ? redirect(302, PROVIDER) : redirect(303, "/"));

/** An opening: a click on the home page's mount `Link`, answered 302 to another origin. The page must be the home page. */
export async function beginOpening(handle: {
  fire(id: string, e: { type: string }): Promise<unknown> | unknown;
}): Promise<void> {
  await handle.fire("mt.home.github", { type: "click" });
  await ticks();
}

/** The `Sent` requests that are not the opening's start request. */
export const returned = (sent: readonly Sent[]): Sent[] => sent.filter((r) => r.url !== START);
