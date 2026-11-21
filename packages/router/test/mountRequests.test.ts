// @vitest-environment happy-dom
// k.return Mount requests and Return links on a router of a shell's ctx (`mountRequests`): what goes through `net`,
// what the external browser opens, where a redirect lands, the loop guard, and which return links are taken.
// Seed 1337 for the properties.
import { type SimCtx, createCtx } from "@keel/ctx";
import { contract } from "@keel/router/contract";
import { mount } from "@keel/runtime-dom";
import { ok, s } from "@keel/schema";
import fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";
import { Form } from "../src/Form.ts";
import { action } from "../src/action.ts";
import { identityMount } from "../src/identityMount.ts";
import { createRouterWith } from "../src/internal/createRouterWith.ts";
import { formHandle } from "../src/internal/formHandle.ts";
import { mountRequests } from "../src/internal/mountRequests.ts";
import { personActs } from "../src/internal/personActs.ts";
import { manifest } from "../src/manifest.ts";
import type { FormHandle } from "../src/types/FormHandle.ts";
import { memoryHistory } from "./memoryHistory.ts";

const auth = identityMount("/auth");
const ID = "dev.keel.app";
const settle = async (): Promise<void> => {
  for (let i = 0; i < 200; i++) await Promise.resolve();
};
const to = (status: number, location: string): Response => new Response(null, { status, headers: { location } });

type Sent = { method: string; url: string; body: string; headers: Record<string, string>; redirect: string };
const stops: (() => void)[] = [];
afterEach(() => {
  for (const stop of stops.splice(0)) stop();
});

/** A shell page: a router over a home page (a `Form` to the mount, with or without a handle) and `/done`. */
function shell(answer: (sent: Sent, i: number) => Response | Promise<Response>, handle?: FormHandle, origin?: string) {
  const ctx: SimCtx = createCtx({ mode: "sim", seed: 1337 });
  const sent: Sent[] = [];
  ctx.net.route("*", async (req) => {
    const u = new URL(req.url);
    const one = {
      method: req.method,
      url: `${u.pathname}${u.search}`,
      body: req.method === "GET" ? "" : await req.text(),
      headers: Object.fromEntries(req.headers),
      redirect: req.redirect,
    };
    sent.push(one);
    return answer(one, sent.length - 1);
  });
  const opened: string[] = [];
  const left: string[] = [];
  const { link, launch } = mountRequests(ctx, { id: ID, open: (url) => void opened.push(url), origin, mounts: [auth] });
  // An ordinary launch: the shell reports no launch link (k.links Launch).
  void launch([]);
  const home = (): Node => {
    const name = document.createElement("input");
    name.name = "name";
    name.value = "a b";
    const by = document.createElement("button");
    by.type = "submit";
    by.name = "via";
    by.value = "button";
    const a = document.createElement("a");
    a.href = auth.href("/start", { p: "1" });
    const away = document.createElement("a");
    away.href = "/elsewhere";
    const children = () => [name, by, a, away];
    const f = Form({ method: "POST", action: auth.href("/in"), children, ...(handle ? { form: handle } : {}) });
    const acted = Form({ method: "POST", action: t.href("t.act") });
    acted.id = "acted";
    const box = document.createElement("div");
    box.append(f, acted);
    return box;
  };
  const t = contract("t", { "t.home": { path: "/" }, "t.done": { path: "/done" }, "t.act": { path: "/act" } });
  const routes = manifest(t, {
    "t.home": { component: home },
    "t.done": { component: () => document.createElement("main") },
    "t.act": {
      component: () => document.createElement("main"),
      POST: action(t, "t.act", { input: s.object({}) }, async () => ok(auth.href("/after"))),
    },
  });
  const router = createRouterWith(routes, { ctx, history: memoryHistory("/"), leave: (u) => void left.push(u) });
  const h = document.createElement("div");
  document.body.append(h);
  const unmount = mount(router.App, h, { ctx });
  stops.push(() => {
    unmount();
    router.dispose();
    h.remove();
  });
  const click = (selector: string): Event => {
    const e = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    h.querySelector(selector)?.dispatchEvent(e);
    return e;
  };
  const submit = (): Event => {
    const e = new SubmitEvent("submit", { bubbles: true, cancelable: true, submitter: h.querySelector("button") });
    h.querySelector("form")?.dispatchEvent(e);
    return e;
  };
  return { ctx, sent, opened, left, link, router, click, submit, h };
}

describe("mount requests", () => {
  it("navigate to the mount is one GET through net with the mount headers; a path elsewhere still leaves", async () => {
    const t = shell(() => new Response("page"));
    await t.router.navigate(auth.href("/x", { a: "1" }));
    await settle();
    expect(t.sent.map((r) => [r.method, r.url, r.redirect])).toEqual([["GET", "/auth/x?a=1", "manual"]]);
    expect(t.sent[0]?.headers).toMatchObject({ "x-keel": "1", accept: "application/json" });
    // A GET answered without a redirect opens its own URL in the external browser.
    expect(t.opened).toEqual(["/auth/x?a=1"]);
    expect(t.left).toEqual([]);
    expect(t.click('a[href="/elsewhere"]').defaultPrevented).toBe(false);
    expect(t.sent).toHaveLength(1);
  });

  it("a link click under the mount is prevented and sent; with a modifier key it is the browser's", async () => {
    const t = shell(() => to(302, "https://provider.example/a?x=1"));
    expect(t.click('a[href^="/auth"]').defaultPrevented).toBe(true);
    await settle();
    expect(t.sent.map((r) => r.url)).toEqual(["/auth/start?p=1"]);
    expect(t.opened).toEqual(["https://provider.example/a?x=1"]);
    const held = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, metaKey: true });
    t.h.querySelector('a[href^="/auth"]')?.dispatchEvent(held);
    expect(held.defaultPrevented).toBe(false);
    expect(t.sent).toHaveLength(1);
  });

  it("a Form without a handle posts its named controls and the submitter, urlencoded", async () => {
    const t = shell(() => to(303, "/done"));
    expect(t.submit().defaultPrevented).toBe(true);
    await settle();
    expect(t.sent.map((r) => [r.method, r.url, r.body])).toEqual([["POST", "/auth/in", "name=a+b&via=button"]]);
    expect(t.sent[0]?.headers["content-type"]).toBe("application/x-www-form-urlencoded");
    expect(t.router.route.get().id).toBe("t.done");
    expect(t.opened).toEqual([]);
  });

  it("a Form with a handle is pending until the chain ends; an invalid one sends nothing", async () => {
    const log: string[] = [];
    let valid = false;
    const handle: FormHandle = {
      [formHandle]: {
        setPending: (v) => void log.push(`pending:${String(v)}`),
        onResult: () => undefined,
        validate: () =>
          valid ? ok(null) : { ok: false, error: { code: "schema.invalid", message: "x", data: { issues: [] } } },
      },
    };
    const t = shell((_s, i) => (i === 0 ? to(303, "/auth/next") : new Response("")), handle);
    t.submit();
    await settle();
    expect(t.sent).toEqual([]);
    valid = true;
    t.submit();
    expect(log.at(-1)).toBe("pending:true");
    await settle();
    expect(t.sent.map((r) => [r.method, r.url])).toEqual([
      ["POST", "/auth/in"],
      ["GET", "/auth/next"],
    ]);
    expect(log.at(-1)).toBe("pending:false");
  });

  it("an action's ok(href) to the mount is a mount request", async () => {
    const t = shell(() => to(303, "/done"));
    t.h.querySelector("#acted")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await settle();
    expect(t.sent.map((r) => r.url)).toEqual(["/auth/after"]);
    expect(t.router.route.get().id).toBe("t.done");
  });

  it("reads a location naming KEEL_ORIGIN in full as its path; another scheme than http(s) opens nothing", async () => {
    const page = shell(() => to(303, "https://api.example/done?x=1"), undefined, "https://api.example");
    await page.router.navigate(auth.href("/x"));
    await settle();
    expect(page.router.route.get().id).toBe("t.done");
    expect(page.opened).toEqual([]);
    for (const location of [
      "javascript:alert(1)",
      "data:text/html,x",
      "file:///etc/passwd",
      "intent://x#Intent;end",
      "http://[",
    ]) {
      const t = shell(() => to(302, location));
      await t.router.navigate(auth.href("/x"));
      await settle();
      expect(t.opened, location).toEqual([]);
      expect(t.sent, location).toHaveLength(1);
    }
    const other = shell(() => to(302, "/billing"));
    await other.router.navigate(auth.href("/x"));
    await settle();
    expect(other.opened).toEqual(["/billing"]);
  });

  it("a redirect to the shell's own scheme is read as a return link", async () => {
    const t = shell((_s, i) => (i === 0 ? to(302, `${ID}:/auth/back?code=c`) : to(303, "/done")));
    await t.router.navigate(auth.href("/x"));
    await settle();
    expect(t.sent.map((r) => r.url)).toEqual(["/auth/x", "/auth/back?code=c"]);
    expect(t.router.route.get().id).toBe("t.done");
  });

  it("a request that fails changes nothing", async () => {
    const t = shell(() => {
      throw new TypeError("network down");
    });
    await t.router.navigate(auth.href("/x"));
    await settle();
    expect(t.opened).toEqual([]);
    expect(t.router.route.get().id).toBe("t.home");
  });

  it("follows at most five redirects in a row under the mount, from a GET or a POST", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 0, max: 12 }), fc.boolean(), async (n, post) => {
        const t = shell((_s, i) => (i < n ? to(302, `/auth/hop${i}`) : new Response("")));
        if (post) t.submit();
        else await t.router.navigate(auth.href("/x"));
        await settle();
        expect(t.sent).toHaveLength(Math.min(n, 5) + 1);
        expect(t.sent.slice(1).every((r) => r.method === "GET" && r.redirect === "manual")).toBe(true);
        // Only a GET that ends without a redirect is opened; a stopped chain opens nothing.
        expect(t.opened).toHaveLength(n <= 5 && (!post || n > 0) ? 1 : 0);
        for (const stop of stops.splice(0)) stop();
      }),
      { seed: 1337, numRuns: 30 },
    );
  });
});

/** Stores an opening on `ctx`, as a mount request that opened the external browser does. */
const pend = (ctx: SimCtx): Promise<void> =>
  ctx.storage.set("keel.return", JSON.stringify({ deadline: ctx.clock.now() + 600000 }));

describe("return links", () => {
  it("takes <id>:/<path> under the mount or to a page, whatever the scheme's case, and nothing else", async () => {
    const path = fc.stringMatching(/^[a-z]{1,6}$/);
    await fc.assert(
      fc.asyncProperty(path, fc.constantFrom(ID, ID.toUpperCase()), async (p, scheme) => {
        const t = shell(() => new Response(""));
        await pend(t.ctx);
        await t.link(`${scheme}:/auth/${p}?code=1`);
        expect(t.sent.map((r) => r.url)).toEqual([`/auth/${p}?code=1`]);
        for (const bad of [
          `${scheme}x:/auth/${p}`,
          `${scheme}://auth/${p}`,
          `${scheme}:auth/${p}`,
          `${scheme}:/\\auth/${p}`,
          `${scheme}:/other/${p}`,
          `https://evil.example/auth/${p}`,
          "",
        ])
          await t.link(bad);
        expect(t.sent).toHaveLength(1);
        expect(t.router.route.get().id).toBe("t.home");
        await pend(t.ctx);
        await t.link(`${scheme}:/done`);
        await settle();
        expect(t.router.route.get().id).toBe("t.done");
        for (const stop of stops.splice(0)) stop();
      }),
      { seed: 1337, numRuns: 20 },
    );
  });

  it("a location or a link whose path begins // or /\\, also once dot segments are removed, is ignored", async () => {
    const off = [
      "/.//evil.example/x",
      "/\\evil.example/x",
      "/./\\evil.example/x",
      "/auth/..//evil.example/x",
      "/\t/evil.example/x",
      "//evil.example/x",
      "\\\\evil.example/x",
      "https://api.example/.//evil.example/x",
      "//keel.invalid/auth/x",
      "/\\keel.invalid/auth/x?t=1",
      "/\t/keel.invalid/auth/x",
      "/.//keel.invalid/auth/x",
    ];
    for (const location of off) {
      const t = shell((_s, i) => (i === 0 ? to(302, location) : new Response("")), undefined, "https://api.example");
      await pend(t.ctx);
      const before = await t.ctx.storage.get("keel.return");
      await t.router.navigate(auth.href("/x"));
      await settle();
      expect(t.opened, location).toEqual([]);
      expect(t.sent, location).toHaveLength(1);
      expect(t.router.route.get().id, location).toBe("t.home");
      await t.link(`${ID}:${location.startsWith("/") ? location : `/${location}`}`);
      await settle();
      expect(t.sent, location).toHaveLength(1);
      expect(t.opened, location).toEqual([]);
      expect(t.router.route.get().id, location).toBe("t.home");
      expect(await t.ctx.storage.get("keel.return"), location).toBe(before);
      for (const stop of stops.splice(0)) stop();
    }
  });

  it("a link whose path does not parse resolves and sends nothing", async () => {
    const t = shell(() => new Response(""));
    await pend(t.ctx);
    for (const bad of [`${ID}://[`, `${ID}:/\\[`, `${ID}://keel.invalid/auth/verify`]) await t.link(bad);
    await settle();
    expect(t.sent).toEqual([]);
    expect(t.opened).toEqual([]);
    expect(t.router.route.get().id).toBe("t.home");
  });

  it("a link under the mount with dot segments is read as the path a URL parser gives", async () => {
    const t = shell(() => new Response(""));
    await pend(t.ctx);
    await t.link(`${ID}:/auth/../done`);
    await settle();
    expect(t.sent).toEqual([]);
    expect(t.router.route.get().id).toBe("t.done");
  });
});

/** The hop after `k` of a chain named `c`: on even hops a path under the mount, on odd ones the shell's own scheme. */
const hop = (c: string, k: number): string => (k % 2 === 0 ? `/auth/${c}${k + 1}` : `${ID}:/auth/${c}${k + 1}`);

describe("chains (k.opening Chains)", () => {
  it("counts mount and own-scheme redirects alike: five in a row are followed, the sixth sends nothing", async () => {
    for (const n of [4, 5, 6]) {
      const t = shell((r) => {
        const k = Number(r.url.slice("/auth/p".length));
        return k < n ? to(302, hop("p", k)) : new Response(null, { status: 404 });
      });
      await t.router.navigate(auth.href("/p0"));
      await settle();
      expect(
        t.sent.map((r) => r.url),
        String(n),
      ).toEqual(Array.from({ length: Math.min(n, 5) + 1 }, (_v, k) => `/auth/p${k}`));
      expect(t.opened, String(n)).toEqual(n <= 5 ? [`/auth/p${n}`] : []);
      for (const stop of stops.splice(0)) stop();
    }
  });

  it("a page-started chain and a link-started chain interleaved each keep their own origin and count", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 0, max: 7 }), fc.integer({ min: 0, max: 7 }), async (np, nl) => {
        let linkArrived: () => void = () => undefined;
        const arrived = new Promise<void>((resolve) => {
          linkArrived = resolve;
        });
        const t = shell(async (r) => {
          const c = r.url.slice("/auth/".length, "/auth/".length + 1);
          const k = Number(r.url.slice("/auth/".length + 1));
          if (c === "l" && k === 0) linkArrived();
          // The page's chain starts only once the link took the opening and its chain is under way; a person acts
          // then, which ends link-started, so the page's chain opens after a person's act and records an opening.
          if (c === "p" && k === 0) {
            await arrived;
            personActs.fired(t.ctx, { type: "click" });
          }
          if (c !== "p" && c !== "l") return new Response(null, { status: 404 });
          const n = c === "p" ? np : nl;
          return k < n ? to(302, hop(c, k)) : new Response(null, { status: 404 });
        });
        await pend(t.ctx);
        const link = t.link(`${ID}:/auth/l0`);
        await t.router.navigate(auth.href("/p0"));
        await link;
        await settle();
        const of = (c: string): string[] => t.sent.map((r) => r.url).filter((u) => u.startsWith(`/auth/${c}`));
        expect(of("p")).toHaveLength(Math.min(np, 5) + 1);
        expect(of("l")).toHaveLength(Math.min(nl, 5) + 1);
        expect([...t.opened].sort()).toEqual(
          [...(np <= 5 ? [`/auth/p${np}`] : []), ...(nl <= 5 ? [`/auth/l${nl}`] : [])].sort(),
        );
        // Only the page's chain records an opening: one link is admitted exactly when it opened the browser.
        const before = t.sent.length;
        await t.link(`${ID}:/auth/x`);
        await settle();
        expect(t.sent.length - before).toBe(np <= 5 ? 1 : 0);
        for (const stop of stops.splice(0)) stop();
      }),
      { seed: 1337, numRuns: 40 },
    );
  });
});
