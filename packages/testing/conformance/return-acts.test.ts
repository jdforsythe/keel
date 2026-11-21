// @vitest-environment happy-dom
// Spec: k.opening, clause "The link's GET answered 302 to `/auto`, a page whose render calls `navigate(mount.href('/login/github'))`, records `https://provider.example/a` in `documents()` again; a second delivery of the link then sends nothing, and after a second `Link` to the mount, a third sends one GET."
// Spec: k.opening, clause "With no opening first, `renderRoute` of `/auto` with no `fire` records `https://provider.example/a` in `documents()`; the link then sends one GET."
// Spec: k.opening, clause "With no opening first, a `fire` `click` on a `Link` to `/auto` records `https://provider.example/a` in `documents()`; the link then sends one GET."
// Spec: k.opening, clause "With no opening first, a `fire` `submit` of a valid `Form` whose action answers `ok(mount.href('/login/github'))` records `https://provider.example/a` in `documents()`; the link then sends one GET."
// Spec: k.opening, clause "An opening at 0 ms (sim clock), then a second at 300000 ms with a `ctx.storage` whose `set` now fails, its `commit` still working: the link at 599999 ms sends one GET; delivered first at 600000 ms instead, it sends nothing."
// Seed 1337 (the sim ctx's seed is 1337). Fixture: act-pages.ts (its own routes; the start request is a GET of /api/auth/login/github).
// ASSUMED: `fire(id, { type: "keydown", key })` carries the key; `fire(formId, { type: "submit" })` submits the Form with that id; `handle.navigate(path)` returns a promise or nothing.
// ASSUMED: the link's own GET is answered 303 to `/` (opens nothing) unless a case says otherwise; a link not admitted sends no `net` request; documents() holds the provider URL as given.
import { createCtx } from "@keel/ctx";
import type { TestEvent } from "@keel/testing";
import { afterEach, describe, expect, it } from "vitest";
import { HOME_HREF, START, mount, routes } from "./act-pages.ts";
import { PROVIDER, SCHEME, SEED, closeAll, openShellOver, redirect, ticks } from "./return-support.ts";
import type { Answer } from "./return-support.ts";

afterEach(closeAll);

const CB_PATH = "/api/auth/callback?code=c";
const CALLBACK = `${SCHEME}:${CB_PATH}`;

const base: Answer = (s) => (s.url === START ? redirect(302, PROVIDER) : redirect(303, "/"));
const providerDocs = (h: { documents(): readonly { url: string }[] }): number =>
  h.documents().filter((d) => d.url === PROVIDER).length;
const callbacks = (sent: readonly { url: string }[]): number => sent.filter((r) => r.url === CB_PATH).length;

async function opening(h: { fire(id: string, e: TestEvent): Promise<unknown> | unknown }): Promise<void> {
  await h.fire("ac.home.github", { type: "click" });
  await ticks();
}

describe("k.opening: a page a return link lands on admits no link", () => {
  it("the link's GET answered 302 to /auto, a page whose render calls navigate(mount.href('/login/github')), records the provider URL in documents() again; a second delivery sends nothing, and after a second Link to the mount, a third sends one GET", async () => {
    expect(mount.href("/login/github")).toBe(START);
    const { handle, sent } = await openShellOver(routes, "ac.home", (s, i) =>
      s.url === CB_PATH ? redirect(302, "/auto") : base(s, i),
    );
    await opening(handle);
    await handle.returnLink(CALLBACK);
    await ticks();
    expect(providerDocs(handle)).toBe(2);
    expect(callbacks(sent)).toBe(1);
    await handle.returnLink(CALLBACK);
    await ticks();
    expect(callbacks(sent)).toBe(1);
    await handle.navigate(HOME_HREF);
    await ticks();
    await opening(handle);
    await handle.returnLink(CALLBACK);
    await ticks();
    expect(callbacks(sent)).toBe(2);
    handle.dispose();
  });
});

describe("k.opening: a chain the page starts records an opening", () => {
  it("with no opening first, renderRoute of /auto with no fire records the provider URL in documents(); the link then sends one GET", async () => {
    const { handle, sent } = await openShellOver(routes, "ac.auto", base);
    await ticks();
    expect(providerDocs(handle)).toBe(1);
    await handle.returnLink(CALLBACK);
    await ticks();
    expect(callbacks(sent)).toBe(1);
    handle.dispose();
  });

  it("with no opening first, a fire click on a Link to /auto records the provider URL in documents(); the link then sends one GET", async () => {
    const { handle, sent } = await openShellOver(routes, "ac.home", base);
    await handle.fire("ac.home.auto", { type: "click" });
    await ticks();
    expect(providerDocs(handle)).toBe(1);
    await handle.returnLink(CALLBACK);
    await ticks();
    expect(callbacks(sent)).toBe(1);
    handle.dispose();
  });

  it("with no opening first, a fire submit of a valid Form whose action answers ok(mount.href('/login/github')) records the provider URL in documents(); the link then sends one GET", async () => {
    const { handle, sent } = await openShellOver(routes, "ac.home", base);
    await handle.fire("ac.home.form", { type: "submit" });
    await ticks();
    expect(providerDocs(handle)).toBe(1);
    await handle.returnLink(CALLBACK);
    await ticks();
    expect(callbacks(sent)).toBe(1);
    handle.dispose();
  });
});

describe("k.opening: the older pending opening stays when the set fails", () => {
  async function linkAt(at: number): Promise<number> {
    const ctx = createCtx({ mode: "sim", seed: SEED });
    const { handle, sent } = await openShellOver(routes, "ac.home", base, ctx);
    await opening(handle);
    await ctx.clock.advance(300000);
    const fails = async (): Promise<never> => {
      throw new Error("disk full");
    };
    Object.assign(ctx.storage, { set: fails });
    await opening(handle);
    expect(providerDocs(handle)).toBe(2);
    await ctx.clock.advance(at - 300000);
    await handle.returnLink(CALLBACK);
    await ticks();
    const n = callbacks(sent);
    handle.dispose();
    return n;
  }

  it("an opening at 0 ms, then a second at 300000 ms with a ctx.storage whose set now fails, its commit still working: the link at 599999 ms sends one GET", async () => {
    expect(await linkAt(599999)).toBe(1);
  });

  it("an opening at 0 ms, then a second at 300000 ms with a ctx.storage whose set now fails, its commit still working: delivered first at 600000 ms, the link sends nothing", async () => {
    expect(await linkAt(600000)).toBe(0);
  });
});
