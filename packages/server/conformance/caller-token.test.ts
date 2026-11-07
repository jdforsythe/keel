// Spec: k.server Conformance: `caller` is the sent cookie's token, else a fresh one set as a cookie on a write, else `""`.
// Seed 1337. Runs under plain Node: happy-dom strips cookie headers. Only runtime (JSON) requests are used.
import { createCtx } from "@keel/ctx";
import { action, loader, manifest } from "@keel/router";
import { ok, s } from "@keel/schema";
import { createApp, topology } from "@keel/server";
import fc from "fast-check";
import { expect, test } from "vitest";

const Out = s.object({ caller: s.string() });
const Nothing = s.object({});
const TOKEN = /^[A-Za-z0-9-]{16,64}$/;
const UUID = "123e4567-e89b-42d3-a456-426614174000";

async function setup() {
  const seen: { loader: string | undefined; action: string | undefined } = { loader: undefined, action: undefined };
  const read = loader({ output: Out }, async ({ caller }) => {
    seen.loader = caller;
    return ok({ caller });
  });
  const write = action({ input: Nothing }, async (_input, { caller }) => {
    seen.action = caller;
    return ok(null);
  });
  const routes = manifest({
    "app.who": { path: "/who", loader: read, actions: { POST: write }, component: () => document.createElement("p") },
  });
  const app = await createApp({
    topology: topology({ web: { modules: ["app"], adapter: "node" } }),
    routes,
    ctx: createCtx({ mode: "sim", seed: 1337 }),
    mode: "production",
  });
  const get = (cookie?: string): Promise<Response> =>
    app.fetch(
      new Request("http://localhost/who", {
        headers: { accept: "application/json", ...(cookie === undefined ? {} : { cookie }) },
      }),
    );
  const post = (cookie?: string): Promise<Response> =>
    app.fetch(
      new Request("http://localhost/who", {
        method: "POST",
        body: "{}",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          origin: "http://localhost",
          ...(cookie === undefined ? {} : { cookie }),
        },
      }),
    );
  return { seen, get, post };
}

test("`caller` is the sent cookie's token (loader and action, any valid token, no set-cookie)", async () => {
  const { seen, get, post } = await setup();
  await fc.assert(
    fc.asyncProperty(fc.stringMatching(TOKEN), async (token) => {
      seen.loader = undefined;
      seen.action = undefined;
      const r = await get(`keel-caller=${token}`);
      expect(r.status).toBe(200);
      expect(seen.loader).toBe(token);
      expect(r.headers.get("set-cookie")).toBeNull();
      const w = await post(`keel-caller=${token}`);
      expect(w.status).toBe(200);
      expect(seen.action).toBe(token);
      expect(w.headers.get("set-cookie")).toBeNull();
    }),
    { seed: 1337, numRuns: 25 },
  );
});

test("`caller` is a fresh token set as an HttpOnly SameSite=Lax Path=/ cookie on a write without one", async () => {
  const { seen, post } = await setup();
  const res = await post();
  expect(res.status).toBe(200);
  const header = res.headers.get("set-cookie");
  expect(header).not.toBeNull();
  const parts = (header ?? "").split(";").map((p) => p.trim());
  const first = parts[0] ?? "";
  expect(first.startsWith("keel-caller=")).toBe(true);
  const token = first.slice("keel-caller=".length);
  expect(token).not.toBe("");
  expect(token).toMatch(TOKEN);
  expect(seen.action).toBe(token);
  const attrs = parts.slice(1).map((p) => p.toLowerCase());
  expect(attrs).toContain("httponly");
  expect(attrs).toContain("samesite=lax");
  expect(attrs).toContain("path=/");
});

test("`caller` is a fresh token set as a cookie on a write: two cookieless writes mint different tokens", async () => {
  const { seen, post } = await setup();
  await post();
  const a = seen.action;
  await post();
  const b = seen.action;
  expect(a).toMatch(TOKEN);
  expect(b).toMatch(TOKEN);
  expect(a).not.toBe(b);
});

test('`caller` is `""` for a read without a cookie, and no cookie is set', async () => {
  const { seen, get } = await setup();
  const res = await get();
  expect(res.status).toBe(200);
  expect(seen.loader).toBe("");
  expect(res.headers.get("set-cookie")).toBeNull();
});

test("`caller` is the sent cookie's token even when other cookies are present", async () => {
  const { seen, get, post } = await setup();
  const cookie = `theme=dark; keel-caller=${UUID}; other=1`;
  expect((await get(cookie)).headers.get("set-cookie")).toBeNull();
  expect(seen.loader).toBe(UUID);
  const w = await post(cookie);
  expect(seen.action).toBe(UUID);
  expect(w.headers.get("set-cookie")).toBeNull();
});
