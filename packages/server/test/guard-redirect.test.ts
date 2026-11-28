// @vitest-environment happy-dom
// Guard redirects on the server (k.guards): writes, failing follow-up hops, foreign `next`, dev log.
import { createCtx } from "@keel/ctx";
import { type RouteTable, action, guard, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { err, ok, s } from "@keel/schema";
import { describe, expect, it } from "vitest";
import { createApp, topology } from "../src/index.ts";

const Denied = s.error("keel.denied", s.object({}));
const deny = (to: string) => guard({ redirect: to }, async () => err(Denied.make({})));
const Page = () => document.createElement("main");
const appOf = (routes: RouteTable, lines: string[] = []) =>
  createApp({
    topology: topology({ web: { modules: ["app"], adapter: "node" } }),
    routes,
    ctx: createCtx({ mode: "sim", seed: 1337 }),
    mode: "dev",
    log: { format: "compact", write: (l: string) => void lines.push(l) },
  });
const get = (path: string, init: RequestInit = {}) => new Request(`http://localhost${path}`, init);
const loop = contract("app", { "app.shell": { layout: true }, "app.login": { path: "/login" } });
const save = action(loop, "app.login", { input: s.object({}) }, async () => ok(null));
const ab = contract("app", { "app.a": { path: "/a" }, "app.b": { path: "/b" } });

describe("server guard redirects", () => {
  it("a write that a looping guard denies is 500 E1508, not 303, and the action does not run", async () => {
    const app = await appOf(
      manifest(loop, {
        "app.shell": { component: Page, guard: deny("app.login") },
        "app.login": { component: Page, layout: "app.shell", POST: save },
      }),
    );
    const res = await app.fetch(get("/login", { method: "POST", headers: { "sec-fetch-site": "same-origin" } }));
    expect(res.status).toBe(500);
    expect(res.headers.get("location")).toBeNull();
  });

  it("a follow-up hop whose guard throws (not a denial) stops the walk: the first redirect stands", async () => {
    const boom = guard({ redirect: "app.a" }, () => Promise.reject(new Error("boom")));
    const app = await appOf(
      manifest(ab, {
        "app.a": { component: Page, guard: deny("app.b") },
        "app.b": { component: Page, guard: boom },
      }),
    );
    const res = await app.fetch(get("/a"));
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/b?next=%2Fa");
  });

  it("a follow-up hop to an unknown URL or a guard-free route ends the walk", async () => {
    const app = await appOf(
      manifest(ab, { "app.a": { component: Page, guard: deny("app.b") }, "app.b": { component: Page } }),
    );
    expect((await app.fetch(get("/a"))).headers.get("location")).toBe("/b?next=%2Fa");
  });

  it("a next on a route no guard redirects to is wrapped as part of the URL; one that is not a same-origin path is dropped (0145)", async () => {
    const c = contract("app", {
      "app.list": { path: "/list" },
      "app.login": { path: "/login" },
      "app.home": { path: "/" },
    });
    const app = await appOf(
      manifest(c, {
        "app.list": { component: Page, guard: deny("app.login") },
        "app.login": { component: Page, guard: deny("app.home") },
        "app.home": { component: Page },
      }),
    );
    expect((await app.fetch(get("/list?next=%2Fpage2"))).headers.get("location")).toBe(
      `/login?next=${encodeURIComponent("/list?next=%2Fpage2")}`,
    );
    for (const evil of [
      "%2F%2Fevil.example",
      "%2F%09%2Fevil.example",
      "%2F%0A%2Fevil.example",
      "%2F%09%5Cevil.example",
    ])
      expect((await app.fetch(get(`/login?next=${evil}`))).headers.get("location")).toBe("/?next=%2Flogin");
    expect((await app.fetch(get("/login?next=%2Flist"))).headers.get("location")).toBe("/?next=%2Flist");
  });

  it("the dev log carries one compact E1508 diag line for a loop", async () => {
    const lines: string[] = [];
    const app = await appOf(
      manifest(loop, {
        "app.shell": { component: Page, guard: deny("app.login") },
        "app.login": { component: Page, layout: "app.shell" },
      }),
      lines,
    );
    await app.fetch(get("/login"));
    const diags = lines.filter((l) => l.startsWith("E1508 "));
    expect(diags).toEqual(["E1508 guard redirect loop: /login -> /login?next=%2Flogin -> /login?next=%2Flogin"]);
  });
});
