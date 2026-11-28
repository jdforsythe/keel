// Spec: k.guards, clause "A guard's `caller` is the hash `createApp` gives loaders (`''` with no signed cookie) and under `renderRoute` its `caller` option (default `''`)." (rfc:0070)
// This file covers the createApp half; packages/testing/conformance/guard-caller-harness.test.ts covers renderRoute.
// Seed 1337. Runs under plain Node: happy-dom strips cookie headers. Only runtime (JSON) requests are used over http.
// @vitest-environment node
import { createCtx } from "@keel/ctx";
import { action, guard, loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { err, ok, s } from "@keel/schema";
import { createApp, topology } from "@keel/server";
import { expect, test } from "vitest";

const Out = s.object({ caller: s.string() });
const Denied = s.error("keel.denied", s.object({}));

async function setup(allow: (caller: string) => boolean) {
  const seen: { guard: string[]; loader: string[] } = { guard: [], loader: [] };
  const gate = guard({ redirect: "app.login" }, async ({ caller }) => {
    seen.guard.push(caller);
    return allow(caller) ? ok(null) : err(Denied.make({}));
  });
  const appContract = contract("app", { "app.login": { path: "/login" }, "app.who": { path: "/who" } });
  const read = loader(appContract, "app.who", { output: Out }, async ({ caller }) => {
    seen.loader.push(caller);
    return ok({ caller });
  });
  const routes = manifest(appContract, {
    "app.login": {
      component: () => document.createElement("p"),
      POST: action(appContract, "app.login", { input: s.object({}) }, async () => ok(null)),
    },
    "app.who": { component: () => document.createElement("p"), loader: read, guard: gate },
  });
  const app = await createApp({
    topology: topology({ web: { modules: ["app"], adapter: "node" } }),
    routes,
    ctx: createCtx({ mode: "sim", seed: 1337 }),
    mode: "production",
    secret: "conformance-secret-guard-0123456789abcdef0123456789abcdef",
  });
  const req = (path: string, init: { method?: string; cookie?: string } = {}): Promise<Response> =>
    app.fetch(
      new Request(`http://localhost${path}`, {
        method: init.method ?? "GET",
        ...(init.method === "POST" ? { body: "{}" } : {}),
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          origin: "http://localhost",
          ...(init.cookie === undefined ? {} : { cookie: init.cookie }),
        },
      }),
    );
  return { seen, req };
}

test('an anonymous request\'s guard gets caller ""', async () => {
  const { seen, req } = await setup(() => true);
  expect((await req("/who")).status).toBe(200);
  expect(seen.guard).toEqual([""]);
  expect(seen.loader).toEqual([""]);
});

test("a guard gets the same caller id as the route's loader for a signed caller cookie", async () => {
  const { seen, req } = await setup((c) => c !== "");
  const minted = (await req("/login", { method: "POST" })).headers.get("set-cookie") ?? "";
  const cookie = minted.split(";")[0] ?? "";
  expect(cookie).toMatch(/^keel-caller=/);
  expect((await req("/who", { cookie })).status).toBe(200);
  const id = seen.guard.at(-1) ?? "";
  expect(id).not.toBe("");
  expect(seen.loader).toEqual([id]);
  expect(cookie).not.toContain(id);
});

test("a guard denying by caller redirects the anonymous request and lets the known one through", async () => {
  const { req } = await setup((c) => c !== "");
  const anon = await req("/who");
  expect([302, 303]).toContain(anon.status);
  const minted = (await req("/login", { method: "POST" })).headers.get("set-cookie") ?? "";
  expect((await req("/who", { cookie: minted.split(";")[0] ?? "" })).status).toBe(200);
});
