// @vitest-environment happy-dom
// Spec: k.guards, clause "A guard redirect revisiting a location, or a ninth, is E1508 (server: 500 `keel.unexpected`); no redirect nests `next`." Seed 1337.
// ASSUMPTIONS: the client shows the E1508 failure through the errorElement nearest the denying guard (at or above its level) as { code: "keel.unexpected", message containing "E1508" },
// or through the default error alert whose text contains "E1508". The ninth-hop cap is covered by the server file (no client-only API to count hops).
import { createCtx } from "@keel/ctx";
import { createRouter, guard, manifest } from "@keel/router";
import { mount } from "@keel/runtime-dom";
import { err, ok, s } from "@keel/schema";
import { describe, expect, it } from "vitest";
import { SEED, memoryHistory, settle } from "./fixtures.ts";

const Denied = s.error("keel.denied", s.object({}));
const Next = s.object({ next: s.string().optional() });
const deny = (to: string) => guard({ redirect: to }, async () => err(Denied.make({})));
const el = (tag: string, text: string, attrs: Record<string, string> = {}) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  e.append(text);
  return e;
};
const page = (n: string) => () => el("main", n, { "data-page": n });
const shell = (p: { children?: () => Node | Node[] | string }) => {
  const e = document.createElement("div");
  const k = p.children?.() ?? "";
  e.append(...[k].flat());
  return e;
};
const errorElement = (p: { error: { code: string; message: string } }) =>
  el("p", `${p.error.code}|${p.error.message}`, { "data-error": "1" });

async function run(defs: Record<string, unknown>, at: string, go: string, mode?: "dev") {
  const routes = Reflect.apply(manifest, undefined, [defs]);
  const history = memoryHistory(at);
  const router = createRouter(routes, {
    ctx: createCtx({ mode: "sim", seed: SEED }),
    history,
    ...(mode === undefined ? {} : { mode }),
  });
  const host = document.createElement("div");
  document.body.append(host);
  const unmount = mount(router.App, host);
  await settle();
  await router.navigate(Reflect.apply(routes.href, routes, [go]));
  await settle();
  const out = { host, url: history.current(), stop: () => (unmount(), router.dispose(), host.remove()) };
  return out;
}

const loopDefs = (withError: boolean) => ({
  "app.shell": { component: shell, guard: deny("app.login"), ...(withError ? { errorElement } : {}) },
  "app.home": { path: "/", component: page("home") },
  "app.login": { path: "/login", search: Next, component: page("login"), layout: "app.shell" },
});

describe("k.guards E1508 client", () => {
  it("a navigation whose guard redirects into a route under the same denying guard renders an errorElement with code keel.unexpected and an E1508 message instead of looping", async () => {
    const r = await run(loopDefs(true), "/", "app.login", "dev");
    const text = r.host.querySelector('[data-error="1"]')?.textContent ?? "";
    expect(text).toContain("keel.unexpected|");
    expect(text).toContain("E1508");
    expect(r.host.querySelector('[data-page="login"]')).toBeNull();
    r.stop();
  });

  it("the same loop with no errorElement shows the default error alert mentioning E1508", async () => {
    const r = await run(loopDefs(false), "/", "app.login", "dev");
    expect(r.host.querySelector('[role="alert"]')?.textContent ?? "").toContain("E1508");
    r.stop();
  });

  it("the same loop with no errorElement and no mode shows the default error alert reading unexpected", async () => {
    const r = await run(loopDefs(false), "/", "app.login");
    const text = r.host.querySelector('[role="alert"]')?.textContent ?? "";
    expect(text).toBe("unexpected");
    expect(text).not.toContain("E1508");
    r.stop();
  });

  it("a two-hop redirect a -> b -> c lands on /c with next equal to the original /a, not nested", async () => {
    const r = await run(
      {
        "app.home": { path: "/", component: page("home") },
        "app.a": { path: "/a", search: Next, component: page("a"), guard: deny("app.b") },
        "app.b": { path: "/b", search: Next, component: page("b"), guard: deny("app.c") },
        "app.c": { path: "/c", search: Next, component: page("c") },
      },
      "/",
      "app.a",
    );
    expect(r.host.querySelector('[data-page="c"]')).not.toBeNull();
    const u = new URL(r.url, "http://localhost");
    expect(u.pathname).toBe("/c");
    expect(u.searchParams.get("next")).toBe("/a");
    r.stop();
  });
});
