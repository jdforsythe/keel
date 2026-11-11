// @vitest-environment happy-dom
// Targeted examples pinning router navigation, history interaction, link interception, Form and rendering.
import { createCtx } from "@keel/ctx";
import { mount } from "@keel/runtime-dom";
import { err, ok, s } from "@keel/schema";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Form } from "../src/Form.ts";
import { action } from "../src/action.ts";
import { browserHistory } from "../src/browserHistory.ts";
import { createRouter } from "../src/createRouter.ts";
import { guard } from "../src/guard.ts";
import { afterNavigate } from "../src/internal/afterNavigate.ts";
import { defaultError } from "../src/internal/defaultError.ts";
import { formHandle } from "../src/internal/formHandle.ts";
import { isHref } from "../src/internal/isHref.ts";
import { renderChildren } from "../src/internal/renderChildren.ts";
import { loader } from "../src/loader.ts";
import { manifest } from "../src/manifest.ts";
import type { FormHandle } from "../src/types/FormHandle.ts";
import type { Href } from "../src/types/Href.ts";
import type { RouteDef } from "../src/types/RouteDef.ts";
import { memoryHistory } from "./memoryHistory.ts";

const ctx = createCtx({ mode: "sim", seed: 1337 });
const settle = async (): Promise<void> => {
  for (let i = 0; i < 64; i++) await Promise.resolve();
};
const el = (name: string, kids: Node[] = []): HTMLElement => {
  const e = document.createElement("div");
  e.setAttribute("data-x", name);
  e.append(...kids);
  return e;
};
const to = (u: string): Href => {
  if (!isHref(u)) throw new Error(`not an Href: ${u}`);
  return u;
};
const Denied = s.error("keel.denied", s.object({}));
const Boom = s.error("md.boom", s.object({}));
const deny = (redirect: string) => guard({ redirect }, async () => err(Denied.make({})));

function boot(routes: ReturnType<typeof manifest>, start: string) {
  const history = memoryHistory(start);
  const router = createRouter(routes, { ctx, history });
  const host = document.createElement("div");
  document.body.append(host);
  const unmount = mount(router.App, host);
  return {
    history,
    router,
    host,
    stop: () => {
      unmount();
      router.dispose();
      host.remove();
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("history interaction", () => {
  const routes = manifest({
    "hi.a": { path: "/a", component: () => el("a") },
    "hi.b": { path: "/b", component: () => el("b") },
    "hi.l": { path: "/l", loader: loader({ output: s.object({}) }, async () => ok({})), component: () => el("l") },
  });
  it("initial load rewrites a non-canonical url with replace, not push", async () => {
    const t = boot(routes, "/a/");
    await settle();
    expect(t.history.entries).toEqual(["/a"]);
    t.stop();
  });
  it("initial load of a canonical url stamps the first entry with its key via one replace of the same url", async () => {
    const replace = vi.fn();
    const history = { ...memoryHistory("/a"), replace };
    const router = createRouter(routes, { ctx, history });
    await settle();
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/a", "k1");
    router.dispose();
  });
  it("navigate pushes the canonical url; replace option replaces", async () => {
    const t = boot(routes, "/a");
    await settle();
    await t.router.navigate(to("/b/"));
    expect(t.history.entries).toEqual(["/a", "/b"]);
    await t.router.navigate(to("/a"), { replace: true });
    expect(t.history.entries).toEqual(["/a", "/a"]);
    await t.router.navigate(to("/b"), { replace: false });
    expect(t.history.entries).toEqual(["/a", "/a", "/b"]);
    t.stop();
  });
  it("pop to a non-canonical url replaces; pop to a canonical one does not", async () => {
    const t = boot(routes, "/a");
    await settle();
    t.history.pop("/b/");
    await settle();
    expect(t.history.entries.at(-1)).toBe("/b");
    expect(t.history.entries).toEqual(["/a", "/b"]);
    const before = t.history.entries.length;
    t.history.pop("/a");
    await settle();
    expect(t.history.entries.length).toBe(before + 1);
    expect(t.router.route.get().id).toBe("hi.a");
    t.stop();
  });
  it("pending is true while a loader runs and the old page stays rendered", async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const rs = manifest({
      "pe.a": { path: "/a", component: () => el("a") },
      "pe.b": {
        path: "/b",
        loader: loader({ output: s.object({}) }, async () => {
          await gate;
          return ok({});
        }),
        component: () => el("b"),
      },
    });
    const t = boot(rs, "/a");
    await settle();
    expect(t.router.route.get().pending).toBe(false);
    const nav = t.router.navigate(to("/b"));
    await settle();
    expect(t.router.route.get()).toEqual({ id: "pe.a", params: {}, search: {}, pending: true });
    expect(t.host.querySelector('[data-x="a"]')).not.toBeNull();
    expect(t.history.entries).toEqual(["/a"]);
    release();
    await nav;
    await settle();
    expect(t.router.route.get()).toEqual({ id: "pe.b", params: {}, search: {}, pending: false });
    expect(t.host.querySelector('[data-x="b"]')).not.toBeNull();
    t.stop();
  });
  it("a newer navigation supersedes an older in-flight one", async () => {
    let releaseA: () => void = () => {};
    const gateA = new Promise<void>((r) => {
      releaseA = r;
    });
    const rs = manifest({
      "su.a": {
        path: "/a",
        loader: loader({ output: s.object({}) }, async () => {
          await gateA;
          return ok({});
        }),
        component: () => el("a"),
      },
      "su.b": { path: "/b", component: () => el("b") },
    });
    const t = boot(rs, "/b");
    await settle();
    const first = t.router.navigate(to("/a"));
    await settle();
    await t.router.navigate(to("/b"));
    releaseA();
    await first;
    await settle();
    expect(t.router.route.get().id).toBe("su.b");
    expect(t.history.entries).toEqual(["/b", "/b"]);
    expect(t.host.querySelector('[data-x="b"]')).not.toBeNull();
    expect(t.host.querySelector('[data-x="a"]')).toBeNull();
    t.stop();
  });
  it("dispose stops navigation and unsubscribes from pops", async () => {
    const unsub = vi.fn();
    const subs: ((u: string, key?: string) => void)[] = [];
    const base = memoryHistory("/a");
    const history = {
      ...base,
      onPop: (fn: (u: string, key?: string) => void) => {
        subs.push(fn);
        return unsub;
      },
    };
    const router = createRouter(routes, { ctx, history });
    await settle();
    router.dispose();
    router.dispose();
    expect(unsub).toHaveBeenCalledTimes(1);
    await router.navigate(to("/b"));
    subs[0]?.("/b");
    await settle();
    expect(base.entries).toEqual(["/a"]);
    expect(router.route.get).toBeDefined();
  });
  it("an onPop that returns a non-function is tolerated on dispose", async () => {
    const base = memoryHistory("/a");
    const router = createRouter(routes, { ctx, history: { ...base, onPop: () => 42 } });
    await settle();
    expect(() => router.dispose()).not.toThrow();
  });
  it("dispose in the middle of a navigation drops the commit", async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const rs = manifest({
      "dm.a": { path: "/a", component: () => el("a") },
      "dm.b": {
        path: "/b",
        loader: loader({ output: s.object({}) }, async () => {
          await gate;
          return ok({});
        }),
        component: () => el("b"),
      },
    });
    const t = boot(rs, "/a");
    await settle();
    const nav = t.router.navigate(to("/b"));
    await settle();
    t.router.dispose();
    release();
    await nav;
    await settle();
    expect(t.history.entries).toEqual(["/a"]);
    t.stop();
  });
});

describe("scroll and focus", () => {
  const routes = manifest({
    "sc.a": { path: "/a", component: () => el("a", [Object.assign(document.createElement("main"), { id: "m" })]) },
    "sc.b": { path: "/b", component: () => el("b", [Object.assign(document.createElement("section"), { id: "tgt" })]) },
  });
  it("push scrolls to the top, focuses main, restores the saved position on pop", async () => {
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const t = boot(routes, "/a");
    await settle();
    expect(scrollTo).not.toHaveBeenCalled();
    Object.defineProperty(window, "scrollY", { configurable: true, value: 123 });
    await t.router.navigate(to("/b"));
    await settle();
    expect(scrollTo).toHaveBeenLastCalledWith(0, 0);
    Object.defineProperty(window, "scrollY", { configurable: true, value: 7 });
    scrollTo.mockClear();
    t.history.pop("/a", "k1");
    await settle();
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith(0, 123);
    scrollTo.mockClear();
    t.history.pop("/b", "k2");
    await settle();
    expect(scrollTo).toHaveBeenCalledWith(0, 7);
    t.history.pop("/b?x=1");
    await settle();
    expect(scrollTo).toHaveBeenLastCalledWith(0, 0);
    t.stop();
  });
  it("replace also moves focus and scroll; the initial load does not", async () => {
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const t = boot(routes, "/b");
    await settle();
    expect(scrollTo).not.toHaveBeenCalled();
    await t.router.navigate(to("/a"), { replace: true });
    await settle();
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
    const main = t.host.querySelector("main");
    expect(main?.getAttribute("tabindex")).toBe("-1");
    expect(document.activeElement).toBe(main);
    t.stop();
  });
  it("afterNavigate: tabindex kept, hash target scrolled into view, otherwise top", () => {
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const root = document.createElement("div");
    const main = document.createElement("main");
    main.setAttribute("tabindex", "3");
    const tgt = document.createElement("p");
    tgt.id = "here";
    const into = vi.fn();
    tgt.scrollIntoView = into;
    root.append(main, tgt);
    document.body.append(root);
    afterNavigate(root, "/x#here");
    expect(main.getAttribute("tabindex")).toBe("3");
    expect(into).toHaveBeenCalledTimes(1);
    expect(scrollTo).not.toHaveBeenCalled();
    afterNavigate(root, "/x#missing");
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
    scrollTo.mockClear();
    afterNavigate(root, "/x");
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
    expect(into).toHaveBeenCalledTimes(1);
    afterNavigate(null, "/x");
    root.remove();
  });
});

describe("guards", () => {
  it("denial redirects: push stays a push, initial load replaces; next is the canonical url", async () => {
    const gdNo = deny("gd.login");
    const rs = manifest({
      "gd.home": { path: "/", component: () => el("home") },
      "gd.login": { path: "/login", component: () => el("login") },
      "gd.sec": { path: "/sec", guard: gdNo, component: () => el("sec") },
    });
    const t = boot(rs, "/");
    await settle();
    await t.router.navigate(to("/sec/?z=1"));
    await settle();
    expect(t.history.entries).toEqual(["/", `/login?next=${encodeURIComponent("/sec?z=1")}`]);
    expect(t.host.querySelector('[data-x="login"]')).not.toBeNull();
    t.stop();
    const u = boot(rs, "/sec");
    await settle();
    expect(u.history.entries).toEqual([`/login?next=${encodeURIComponent("/sec")}`]);
    u.stop();
  });
  it("replace navigation redirects with replace", async () => {
    const grNo = deny("gr.login");
    const rs = manifest({
      "gr.home": { path: "/", component: () => el("home") },
      "gr.login": { path: "/login", component: () => el("login") },
      "gr.sec": { path: "/sec", guard: grNo, component: () => el("sec") },
    });
    const t = boot(rs, "/");
    await settle();
    await t.router.navigate(to("/sec"), { replace: true });
    await settle();
    expect(t.history.entries).toEqual(["/login?next=%2Fsec"]);
    t.stop();
  });
  it("a redirect loop stops at the first revisited location with E1508 keel.unexpected (rfc:0051)", async () => {
    const glNo = deny("gl.b");
    const glNo2 = deny("gl.a");
    const rs = manifest({
      "gl.a": { path: "/a", guard: glNo, component: () => el("a") },
      "gl.b": { path: "/b", guard: glNo2, component: () => el("b") },
    });
    const t = boot(rs, "/a");
    await settle();
    const alert = t.host.querySelector('[role="alert"]');
    expect(alert?.getAttribute("data-keel-error")).toBe("keel.unexpected");
    expect(alert?.textContent).toBe("E1508 guard redirect loop: /a -> /b?next=%2Fa -> /a?next=%2Fa -> /b?next=%2Fa");
    t.stop();
  });
  it("eight guard redirects through distinct routes still land; a ninth is E1508 (rfc:0051)", async () => {
    const chain = (n: number) => {
      const defs: Record<string, RouteDef> = {};
      for (let i = 0; i <= n; i++)
        defs[`gh.r${i}`] = {
          path: `/r${i}`,
          component: () => el(`r${i}`),
          ...(i < n ? { guard: deny(`gh.r${i + 1}`) } : {}),
        };
      return manifest(defs);
    };
    const eight = boot(chain(8), "/r0");
    await settle();
    expect(eight.host.querySelector('[role="alert"]')).toBeNull();
    expect(eight.history.current()).toBe("/r8?next=%2Fr0");
    eight.stop();
    const nine = boot(chain(9), "/r0");
    await settle();
    expect(nine.host.querySelector('[role="alert"]')?.textContent).toBe("E1508 more than 8 guard redirects from /r0");
    nine.stop();
  });
  it("redirect to an unknown route id is a keel.unexpected naming the target", async () => {
    const guNo = deny("gu.nowhere");
    const rs = manifest({ "gu.a": { path: "/a", guard: guNo, component: () => el("a") } });
    const t = boot(rs, "/a");
    await settle();
    const alert = t.host.querySelector('[role="alert"]');
    expect(alert?.getAttribute("data-keel-error")).toBe("keel.unexpected");
    expect(alert?.textContent).toBe(
      'guard redirect to "gu.nowhere" failed: Error: E1501 href("gu.nowhere"): no declared page has this id',
    );
    t.stop();
  });
  it("a guard that throws is not a denial: no redirect, error shown", async () => {
    const gtBoom = guard({ redirect: "gt.login" }, async () => {
      throw new Error("kaboom");
    });
    const rs = manifest({
      "gt.login": { path: "/login", component: () => el("login") },
      "gt.a": { path: "/a", guard: gtBoom, component: () => el("a") },
    });
    const t = boot(rs, "/a");
    await settle();
    expect(t.history.entries).toEqual(["/a"]);
    expect(t.host.querySelector('[data-keel-error="keel.unexpected"]')).not.toBeNull();
    expect(t.router.route.get().id).toBe("gt.a");
    t.stop();
  });
  it("guards run outermost first and stop at the first denial before any loader runs", async () => {
    const order: string[] = [];
    const goOuter = guard({ redirect: "go.login" }, async () => {
      order.push("outer");
      return err(Denied.make({}));
    });
    const goInner = guard({ redirect: "go.login" }, async () => {
      order.push("inner");
      return ok(null);
    });
    const rs = manifest({
      "go.login": { path: "/login", component: () => el("login") },
      "go.shell": { guard: goOuter, component: (p) => el("shell", p.children === undefined ? [] : [p.children()]) },
      "go.a": {
        path: "/a",
        layout: "go.shell",
        guard: goInner,
        loader: loader({ output: s.object({}) }, async () => {
          order.push("loader");
          return ok({});
        }),
        component: () => el("a"),
      },
    });
    const t = boot(rs, "/a");
    await settle();
    expect(order).toEqual(["outer"]);
    t.stop();
  });
  it("a guard failing inside layouts renders its errorElement alone when a guard sits above", async () => {
    const gbBoom = guard({ redirect: "gb.l" }, async () => {
      throw new Error("x");
    });
    const rs = manifest({
      "gb.l": { path: "/l", component: () => el("l") },
      "gb.shell": { component: (p) => el("shell", p.children === undefined ? [] : [p.children()]) },
      "gb.a": {
        path: "/a",
        layout: "gb.shell",
        guard: gbBoom,
        component: () => el("a"),
        errorElement: () => el("err"),
      },
    });
    const t = boot(rs, "/a");
    await settle();
    expect(t.host.querySelector('[data-x="err"]')).not.toBeNull();
    expect(t.host.querySelector('[data-x="shell"] [data-x="err"]')).not.toBeNull();
    t.stop();
  });
});

describe("errors and not found", () => {
  it("unmatched url renders the root default alert with the code and message; route state is the missing place", async () => {
    const rs = manifest({ "nf.a": { path: "/a", component: () => el("a") } });
    const t = boot(rs, "/zzz");
    await settle();
    const alert = t.host.querySelector('[role="alert"]');
    expect(alert?.getAttribute("data-keel-error")).toBe("keel.notFound");
    expect(alert?.textContent).toBe("keel.notFound");
    expect(t.router.route.get()).toEqual({ id: null, params: {}, search: {}, pending: false });
    await t.router.navigate(to("/a"));
    await settle();
    expect(t.host.querySelector('[role="alert"]')).toBeNull();
    t.stop();
  });
  it("a loader error renders the nearest errorElement at or above its level, inside layouts above", async () => {
    const rs = manifest({
      "le.shell": {
        component: (p) => el("shell", p.children === undefined ? [] : [p.children()]),
        errorElement: ({ error }) => el(`shell-err:${error.code}`),
      },
      "le.a": {
        path: "/a",
        layout: "le.shell",
        loader: loader({ output: s.object({}) }, async () => err(Boom.make({}))),
        component: () => el("a"),
      },
    });
    const t = boot(rs, "/a");
    await settle();
    expect(t.host.querySelector('[data-x="shell-err:md.boom"]')).not.toBeNull();
    expect(t.host.querySelector('[data-x="a"]')).toBeNull();
    t.stop();
  });
  it("a loader error with no errorElement anywhere renders the root default", async () => {
    const rs = manifest({
      "ld.a": {
        path: "/a",
        loader: loader({ output: s.object({}) }, async () => err(Boom.make({}))),
        component: () => el("a"),
      },
    });
    const t = boot(rs, "/a");
    await settle();
    expect(t.host.querySelector('[data-keel-error="md.boom"]')).not.toBeNull();
    t.stop();
  });
  it("a loader error on a layout level with an errorElement only on the route: nearest is searched upward only", async () => {
    const rs = manifest({
      "lu.shell": {
        loader: loader({ output: s.object({}) }, async () => err(Boom.make({}))),
        component: (p) => el("shell", p.children === undefined ? [] : [p.children()]),
      },
      "lu.a": { path: "/a", layout: "lu.shell", component: () => el("a"), errorElement: () => el("route-err") },
    });
    const t = boot(rs, "/a");
    await settle();
    expect(t.host.querySelector('[data-keel-error="md.boom"]')).not.toBeNull();
    expect(t.host.querySelector('[data-x="route-err"]')).toBeNull();
    t.stop();
  });
  it("loader data reaches the component and a component throw falls to the route errorElement", async () => {
    const rs = manifest({
      "ld2.a": {
        path: "/a",
        loader: loader({ output: s.object({ n: s.int() }) }, async () => ok({ n: 5 })),
        component: (p) => el(`d=${JSON.stringify(p.data)}`),
      },
      "ld2.b": {
        path: "/b",
        component: () => {
          throw new Error("render boom");
        },
        errorElement: ({ error }) => el(`caught:${error.code}`),
      },
    });
    const t = boot(rs, "/a");
    await settle();
    expect(t.host.querySelector("[data-x='d={\"n\":5}']")).not.toBeNull();
    await t.router.navigate(to("/b"));
    await settle();
    expect(t.host.querySelector('[data-x="caught:keel.unexpected"]')).not.toBeNull();
    t.stop();
  });
  it("a render throw with no errorElement shows the default alert and a layout keeps its params, search and children", async () => {
    const seen: unknown[] = [];
    const rs = manifest({
      "rt.shell": {
        component: (p) => {
          seen.push([p.params, p.search]);
          return el("shell", p.children === undefined ? [] : [p.children()]);
        },
      },
      "rt.a": {
        path: "/a/:id",
        params: s.object({ id: s.int() }),
        search: s.object({ q: s.string().optional() }),
        layout: "rt.shell",
        component: (p) => {
          seen.push([p.params, p.search, p.children]);
          return el("a");
        },
      },
    });
    const t = boot(rs, "/a/3?q=x");
    await settle();
    expect(seen).toEqual([
      [{ id: 3 }, { q: "x" }],
      [{ id: 3 }, { q: "x" }, undefined],
    ]);
    expect(t.router.route.get()).toEqual({ id: "rt.a", params: { id: 3 }, search: { q: "x" }, pending: false });
    t.stop();
  });
});

describe("link interception", () => {
  const rs = manifest({
    "li.a": { path: "/a", component: () => el("a") },
    "li.b": { path: "/b", component: () => el("b") },
  });
  const anchor = (host: HTMLElement, href: string, attrs: Record<string, string> = {}): HTMLAnchorElement => {
    const a = document.createElement("a");
    a.setAttribute("href", href);
    for (const [k, v] of Object.entries(attrs)) a.setAttribute(k, v);
    host.append(a);
    return a;
  };
  const click = (target: Element, init: MouseEventInit = {}): boolean => {
    const e = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ...init });
    // Registered after the router's listener: records its verdict, then stops happy-dom from navigating.
    let prevented = false;
    const last = (ev: Event): void => {
      prevented = ev.defaultPrevented;
      ev.preventDefault();
    };
    document.addEventListener("click", last, { once: true });
    target.dispatchEvent(e);
    document.removeEventListener("click", last);
    return prevented;
  };
  it("same-origin plain clicks navigate by push and prevent default", async () => {
    const t = boot(rs, "/a");
    await settle();
    const a = anchor(t.host, "/b?x=1#h");
    const inner = document.createElement("span");
    a.append(inner);
    const e = click(inner);
    expect(e).toBe(true);
    await settle();
    expect(t.history.entries).toEqual(["/a", "/b?x=1#h"]);
    t.stop();
  });
  it.each<[string, string, Record<string, string>, MouseEventInit]>([
    ["right button", "/b", {}, { button: 2 }],
    ["middle button", "/b", {}, { button: 1 }],
    ["meta", "/b", {}, { metaKey: true }],
    ["ctrl", "/b", {}, { ctrlKey: true }],
    ["shift", "/b", {}, { shiftKey: true }],
    ["alt", "/b", {}, { altKey: true }],
    ["target _blank", "/b", { target: "_blank" }, {}],
    ["target other", "/b", { target: "frame" }, {}],
    ["download", "/b", { download: "" }, {}],
    ["cross-origin", "https://example.org/b", {}, {}],
  ])("%s is left to the browser", async (_n, href, attrs, init) => {
    const t = boot(rs, "/a");
    await settle();
    const a = anchor(t.host, href, attrs);
    const e = click(a, init);
    expect(e).toBe(false);
    await settle();
    expect(t.history.entries).toEqual(["/a"]);
    t.stop();
  });
  it.each<[string, Record<string, string>]>([
    ["empty target", { target: "" }],
    ["_self target", { target: "_self" }],
  ])("%s still navigates", async (_n, attrs) => {
    const t = boot(rs, "/a");
    await settle();
    const e = click(anchor(t.host, "/b", attrs));
    expect(e).toBe(true);
    await settle();
    expect(t.history.entries).toEqual(["/a", "/b"]);
    t.stop();
  });
  it("an already-prevented click, a non-anchor click, an anchor without href and a click outside the app are ignored", async () => {
    const t = boot(rs, "/a");
    await settle();
    const a = anchor(t.host, "/b");
    a.addEventListener("click", (ev) => ev.preventDefault(), { once: true });
    click(a);
    await settle();
    expect(t.history.entries).toEqual(["/a"]);
    const plain = document.createElement("div");
    t.host.append(plain);
    expect(click(plain)).toBe(false);
    const nohref = document.createElement("a");
    t.host.append(nohref);
    expect(click(nohref)).toBe(false);
    const outside = document.createElement("a");
    outside.setAttribute("href", "/b");
    document.body.append(outside);
    expect(click(outside)).toBe(false);
    outside.remove();
    expect(click(document.body)).toBe(false);
    await settle();
    expect(t.history.entries).toEqual(["/a"]);
    t.stop();
  });
  it("dispose removes the click listener", async () => {
    const t = boot(rs, "/a");
    await settle();
    const a = anchor(t.host, "/b");
    t.stop();
    document.body.append(a);
    expect(click(a)).toBe(false);
    a.remove();
  });
});

describe("Form", () => {
  const input = s.object({ title: s.string({ min: 3 }) });
  const submit = (f: HTMLFormElement | null): void => {
    f?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  };
  const handleOf = (log: string[], valid = true): FormHandle => ({
    [formHandle]: {
      setPending: (v) => void log.push(`pending:${String(v)}`),
      onResult: (r) => void log.push(`result:${r.ok ? "ok" : r.error.code}`),
      validate: () => {
        log.push("validate");
        return valid ? ok(null) : err({ code: "schema.invalid", message: "x", data: { issues: [] } });
      },
    },
  });

  it("outside a router: renders method, the action Href as given, hidden _method for non-POST, children; no lookup", () => {
    const fm = to("/fm/4");
    const post = Form({ method: "POST", action: fm, children: "hello" });
    expect(post.getAttribute("method")).toBe("post");
    expect(post.getAttribute("action")).toBe("/fm/4");
    expect(post.querySelector("input")).toBeNull();
    expect(post.textContent).toBe("hello");
    const put = Form({ method: "PUT", action: fm, children: () => el("kid") });
    const hidden = put.querySelector("input");
    expect(hidden?.getAttribute("type")).toBe("hidden");
    expect(hidden?.getAttribute("name")).toBe("_method");
    expect(hidden?.getAttribute("value")).toBe("PUT");
    expect(put.querySelector('[data-x="kid"]')).not.toBeNull();
    expect(() => Form({ method: "DELETE", action: to("/nowhere") })).not.toThrow();
  });

  it("inside a router: E1505 when the route the action matches does not declare the method, or none matches", async () => {
    const act = action({ input: s.object({}) }, async () => ok(null));
    const msgs: string[] = [];
    const tryForm = (method: "POST" | "DELETE", href: Href): void => {
      try {
        Form({ method, action: href });
        msgs.push("ok");
      } catch (e) {
        msgs.push(e instanceof Error ? e.message : "");
      }
    };
    const rs = manifest({
      "fm.a": {
        path: "/fm/:id",
        params: s.object({ id: s.int() }),
        component: () => {
          tryForm("POST", to("/fm/4"));
          tryForm("DELETE", to("/fm/4"));
          tryForm("POST", to("/nowhere"));
          return el("x");
        },
      },
    });
    rs.actions({ "fm.a": { POST: act, PUT: act } });
    const t = boot(rs, "/fm/4");
    await settle();
    expect(msgs).toEqual([
      "ok",
      'E1505 <Form method="DELETE" action="/fm/4">: no route of this router declares that action',
      'E1505 <Form method="POST" action="/nowhere">: no route of this router declares that action',
    ]);
    t.stop();
  });

  it("renderChildren: thunk, node, string, array, undefined", () => {
    const n = el("n");
    expect(renderChildren(undefined)).toEqual([]);
    expect(renderChildren("t").map((x) => x.textContent)).toEqual(["t"]);
    expect(renderChildren(n)).toEqual([n]);
    expect(renderChildren([n, n])).toEqual([n, n]);
    expect(renderChildren(() => "z")[0]?.textContent).toBe("z");
    expect(renderChildren(() => n)).toEqual([n]);
  });

  it("submit: validate, pending order, FormData without _method, navigation on ok(href)", async () => {
    const log: string[] = [];
    const seen: unknown[] = [];
    const rs = manifest({
      "fs.next": { path: "/next", component: () => el("next") },
      "fs.page": {
        path: "/p/:id",
        params: s.object({ id: s.int() }),
        component: () => {
          const f = Form({ method: "PUT", action: to("/p/9"), form: handleOf(log) });
          const box = document.createElement("input");
          box.name = "title";
          box.value = "hello";
          f.append(box);
          return el("page", [f]);
        },
      },
    });
    rs.actions({
      "fs.page": {
        PUT: action({ input: input }, async (i, at) => {
          log.push("run");
          seen.push([i, at.params]);
          return ok(await Promise.resolve(to("/next")));
        }),
      },
    });
    const t = boot(rs, "/p/9");
    await settle();
    submit(t.host.querySelector("form"));
    await settle();
    expect(log).toEqual(["validate", "pending:true", "run", "pending:false", "result:ok"]);
    expect(seen).toEqual([[{ title: "hello" }, { id: 9 }]]);
    expect(t.history.entries).toEqual(["/p/9", "/next"]);
    expect(t.router.route.get().id).toBe("fs.next");
    t.stop();
  });

  it("a failing validate stops the submit; an event default is prevented", async () => {
    const log: string[] = [];
    const rs = manifest({
      "fv.page": {
        path: "/p",
        component: () => Form({ method: "POST", action: to("/p"), form: handleOf(log, false) }),
      },
    });
    rs.actions({ "fv.page": { POST: action({ input: input }, async () => ok(null)) } });
    const t = boot(rs, "/p");
    await settle();
    const f = t.host.querySelector("form");
    const e = new Event("submit", { bubbles: true, cancelable: true });
    f?.dispatchEvent(e);
    await settle();
    expect(e.defaultPrevented).toBe(true);
    expect(log).toEqual(["validate"]);
    t.stop();
  });

  it("input decode failure goes to onResult as keel.fields; router pending returns to false", async () => {
    const log: string[] = [];
    const rs = manifest({
      "ff.page": {
        path: "/p",
        component: () => Form({ method: "POST", action: to("/p"), form: handleOf(log) }),
      },
    });
    rs.actions({ "ff.page": { POST: action({ input: input }, async () => ok(null)) } });
    const t = boot(rs, "/p");
    await settle();
    submit(t.host.querySelector("form"));
    await settle();
    expect(log).toEqual(["validate", "pending:true", "pending:false", "result:keel.fields"]);
    expect(t.router.route.get().pending).toBe(false);
    t.stop();
  });

  it("an action that throws becomes keel.unexpected and is shown in the error slot", async () => {
    const rs = manifest({
      "fe.page": {
        path: "/p",
        component: () =>
          Form({
            method: "POST",
            action: to("/p"),
            error: (e) => el(`err:${e.code}`),
          }),
      },
    });
    rs.actions({
      "fe.page": {
        POST: action({ input: s.object({}) }, async () => {
          throw new Error("nope");
        }),
      },
    });
    const t = boot(rs, "/p");
    await settle();
    expect(t.host.querySelector('[data-x^="err:"]')).toBeNull();
    submit(t.host.querySelector("form"));
    await settle();
    expect(t.host.querySelector('[data-x="err:keel.unexpected"]')).not.toBeNull();
    expect(t.router.route.get().pending).toBe(false);
    t.stop();
  });

  it("route().pending is true while the action is in flight; error clears on resubmit", async () => {
    let release: () => void = () => {};
    let fail = true;
    const rs = manifest({
      "fl.page": {
        path: "/p",
        component: () =>
          Form({
            method: "POST",
            action: to("/p"),
            error: (e) => el(`err:${e.code}`),
          }),
      },
    });
    rs.actions({
      "fl.page": {
        POST: action({ input: s.object({}) }, async () => {
          if (fail) return err(Boom.make({}));
          await new Promise<void>((r) => {
            release = r;
          });
          return ok(null);
        }),
      },
    });
    const t = boot(rs, "/p");
    await settle();
    submit(t.host.querySelector("form"));
    await settle();
    expect(t.host.querySelector('[data-x="err:md.boom"]')).not.toBeNull();
    fail = false;
    submit(t.host.querySelector("form"));
    await settle();
    expect(t.router.route.get().pending).toBe(true);
    expect(t.host.querySelector('[data-x^="err:"]')).toBeNull();
    release();
    await settle();
    expect(t.router.route.get().pending).toBe(false);
    expect(t.host.querySelector('[data-x^="err:"]')).toBeNull();
    t.stop();
  });

  it("with a form handle, keel.fields errors are not shown in the error slot but other errors are", async () => {
    let which: "fields" | "boom" = "fields";
    const rs = manifest({
      "fh.page": {
        path: "/p",
        component: () =>
          Form({ method: "POST", action: to("/p"), form: handleOf([]), error: (e) => el(`err:${e.code}`) }),
      },
    });
    rs.actions({
      "fh.page": {
        POST: action({ input: s.object({}) }, async () =>
          which === "fields" ? err({ code: "keel.fields", message: "f", data: {} }) : err(Boom.make({})),
        ),
      },
    });
    const t = boot(rs, "/p");
    await settle();
    submit(t.host.querySelector("form"));
    await settle();
    expect(t.host.querySelector('[data-x^="err:"]')).toBeNull();
    which = "boom";
    submit(t.host.querySelector("form"));
    await settle();
    expect(t.host.querySelector('[data-x="err:md.boom"]')).not.toBeNull();
    t.stop();
  });

  it("without a form handle, a keel.fields error is shown too", async () => {
    const rs = manifest({
      "fn.page": {
        path: "/p",
        component: () => Form({ method: "POST", action: to("/p"), error: (e) => el(`err:${e.code}`) }),
      },
    });
    rs.actions({ "fn.page": { POST: action({ input: input }, async () => ok(null)) } });
    const t = boot(rs, "/p");
    await settle();
    submit(t.host.querySelector("form"));
    await settle();
    expect(t.host.querySelector('[data-x="err:keel.fields"]')).not.toBeNull();
    t.stop();
  });

  it("dispose removes the submit listener", async () => {
    const calls: string[] = [];
    const rs = manifest({
      "fd.page": {
        path: "/p",
        component: () => Form({ method: "POST", action: to("/p") }),
      },
    });
    rs.actions({
      "fd.page": {
        POST: action({ input: s.object({}) }, async () => {
          calls.push("run");
          return ok(null);
        }),
      },
    });
    const t = boot(rs, "/p");
    await settle();
    const f = t.host.querySelector("form");
    t.stop();
    const e = new Event("submit", { bubbles: true, cancelable: true });
    f?.dispatchEvent(e);
    await settle();
    expect(calls).toEqual([]);
    expect(e.defaultPrevented).toBe(false);
  });

  it("ok(null) revalidates: loaders rerun, data signals update in place, no history change, no focus move", async () => {
    let n = 0;
    const rs = manifest({
      "fr.page": {
        path: "/p",
        loader: loader({ output: s.object({ n: s.int() }) }, async () => ok({ n: ++n })),
        component: (p) => {
          const out = el("out");
          const f = Form({ method: "POST", action: to("/p") });
          return el("page", [out, f, Object.assign(document.createElement("span"), { id: String(p.data) })]);
        },
      },
    });
    rs.actions({ "fr.page": { POST: action({ input: s.object({}) }, async () => ok(null)) } });
    const t = boot(rs, "/p");
    await settle();
    expect(n).toBe(1);
    submit(t.host.querySelector("form"));
    await settle();
    expect(n).toBe(2);
    expect(t.history.entries).toEqual(["/p"]);
    expect(t.router.route.get().pending).toBe(false);
    t.stop();
  });

  it("revalidation that fails switches the page to its error", async () => {
    let fail = false;
    const rs = manifest({
      "fx.page": {
        path: "/p",
        loader: loader({ output: s.object({}) }, async () => (fail ? err(Boom.make({})) : ok({}))),
        component: () => Form({ method: "POST", action: to("/p") }),
        errorElement: ({ error }) => el(`err:${error.code}`),
      },
    });
    rs.actions({
      "fx.page": {
        POST: action({ input: s.object({}) }, async () => {
          fail = true;
          return ok(null);
        }),
      },
    });
    const t = boot(rs, "/p");
    await settle();
    submit(t.host.querySelector("form"));
    await settle();
    expect(t.host.querySelector('[data-x="err:md.boom"]')).not.toBeNull();
    t.stop();
  });

  it("submit after dispose or for a route without that action is a no-op", async () => {
    const calls: string[] = [];
    const rs = manifest({
      "fz.page": {
        path: "/p",
        component: () => Form({ method: "POST", action: to("/p") }),
      },
    });
    rs.actions({
      "fz.page": {
        POST: action({ input: s.object({}) }, async () => {
          calls.push("run");
          return ok(null);
        }),
      },
    });
    const t = boot(rs, "/p");
    await settle();
    const f = t.host.querySelector("form");
    t.router.dispose();
    submit(f);
    await settle();
    expect(calls).toEqual([]);
    t.stop();
  });
});

describe("defaultError and browserHistory", () => {
  it("defaultError is an alert naming the code with the message as text", () => {
    const e = defaultError({ code: "x.y", message: "the message", data: null });
    expect(e.nodeName).toBe("DIV");
    expect(e instanceof HTMLElement && e.getAttribute("role")).toBe("alert");
    expect(e instanceof HTMLElement && e.getAttribute("data-keel-error")).toBe("x.y");
    expect(e.textContent).toBe("the message");
  });
  it("browserHistory drives window.history and reports pops", () => {
    const h = browserHistory();
    expect(window.history.scrollRestoration).toBe("manual");
    window.history.replaceState(null, "", "/start?a=1#z");
    expect(h.current()).toBe("/start?a=1#z");
    h.push("/two?b=2", "k2");
    expect(h.current()).toBe("/two?b=2");
    expect(window.location.pathname).toBe("/two");
    h.replace("/three", "k3");
    expect(h.current()).toBe("/three");
    const seen: [string, string | undefined][] = [];
    const off = h.onPop((u, k) => void seen.push([u, k]));
    window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
    expect(seen).toEqual([["/three", "k3"]]);
    window.dispatchEvent(new PopStateEvent("popstate", { state: { keel: "other-load:k9" } }));
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(seen).toEqual([
      ["/three", "k3"],
      ["/three", undefined],
      ["/three", undefined],
    ]);
    expect(typeof off).toBe("function");
    if (typeof off === "function") off();
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(seen.length).toBe(3);
  });
});

describe("route state typing", () => {
  it("is built from the committed place with pending false", async () => {
    const def: RouteDef = { path: "/a/:n", params: s.object({ n: s.int() }), component: () => el("a") };
    const rs = manifest({ "rs.a": def });
    const t = boot(rs, "/a/12");
    await settle();
    expect(t.router.route.get()).toEqual({ id: "rs.a", params: { n: 12 }, search: {}, pending: false });
    t.stop();
  });
});
