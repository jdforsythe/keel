// Spec: k.user, Across deployables "A forwarded request (k.topology) keeps its headers, so the peer runs its own `identify`. A `service({ module })` method takes `user?: string`, sent as `x-keel-user`: HMAC-SHA-256 under `createApp({ secret })` over method, path, search, `user` and an expiry 60 s ahead on `ctx.clock`. A server that verifies it uses it as `user` and runs no `identify`; any other `x-keel-user` is ignored. On a ctx with no secret (a browser) `user` is `api.input`."
// Spec: k.user, Conformance "`service({ module: 'b' })` with `user: 'u1'`, in process and split: `b`'s loader gets `'u1'` and `b`'s `identify` is not called; that header resent after 61 s, to another path or with one changed character is ignored and `identify` runs; on a ctx with no secret, `api.input`."
// Seed 1337 (fc.assert below). Fixture modules `a` (its loader calls `service({ module: 'b' })` with a user) and `b`, served as `{ one: [a, b] }` and as `{ x: [a], y: [b] }` under one secret; the sim net routes `http://y.test` to `y`.
// The header's format is not specified, so every header here is one `x` captured from a real call.
// @vitest-environment node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createCtx } from "@keel/ctx";
import { action, loader, manifest, routesArtifact } from "@keel/router";
import { err, ok, s } from "@keel/schema";
import { createApp, identity, topology } from "@keel/server";
import { endpoints, service } from "@keel/services";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
const SEED = 1337;
const SECRET = "conformance-secret-user-0123456789abcdef0123456789abcdef";

const Params = s.object({ n: s.string() });
const Item = s.object({ n: s.string(), user: s.string() });
const Boom = s.error("a.boom", s.object({}));
const schema = endpoints({
  get: { method: "GET", path: "/b/:n", params: Params, output: Item },
  put: { method: "POST", path: "/b/:n", params: Params, body: s.object({}), output: s.string().nullable() },
});
const view = () => document.createElement("main");
const userArb = fc.stringMatching(/^[A-Za-z0-9]{1,40}$/);

interface Captured {
  readonly method: string;
  readonly url: string;
  readonly header: string | null;
}

async function bed(o: { split: boolean; user?: string | undefined; yAnswer?: string; yCookie?: boolean }) {
  const seenB: { get: string[]; put: string[] } = { get: [], put: [] };
  const identifiedX: Request[] = [];
  const identifiedY: Request[] = [];
  const api = service({ module: "b", schema });
  const callUser = o.user;
  const aShow = loader({ output: Item, params: Params }, async ({ params }, ctx) => {
    const r = await api.get({ params, ...(callUser === undefined ? {} : { user: callUser }) }, ctx);
    return r.ok ? ok(r.value) : err(Boom.make({}));
  });
  const bGet = loader({ output: Item, params: Params }, async ({ params, user }) => {
    seenB.get.push(user);
    return ok({ n: params.n, user });
  });
  const bPut = action({ input: s.object({}), params: Params }, async (_i, { user }) => {
    seenB.put.push(user);
    return ok(null);
  });
  const routesOf = (which: "a" | "b" | "both") => {
    const defs = {
      ...(which === "b" ? {} : { "a.show": { path: "/a/:n", params: Params, loader: aShow, component: view } }),
      ...(which === "a" ? {} : { "b.show": { path: "/b/:n", params: Params, loader: bGet, component: view } }),
    };
    const m = manifest(defs);
    if (which !== "a") m.actions({ "b.show": { POST: bPut } });
    return m;
  };
  const idOf = (log: Request[], answer: string) =>
    identity({
      identify: async ({ request }) => {
        log.push(request);
        return o.yCookie === true ? (request.headers.get("cookie") ?? "") : answer;
      },
    });
  const artifacts = fs.mkdtempSync(path.join(os.tmpdir(), "keel-user-peers-"));
  fs.writeFileSync(
    path.join(artifacts, "routes.json"),
    JSON.stringify({ data: routesArtifact(routesOf("b")), hash: "" }),
  );
  const captured: Captured[] = [];
  const ctxX = createCtx({ mode: "sim", seed: SEED });
  const ctxY = createCtx({ mode: "sim", seed: SEED });
  if (!o.split) {
    const one = await createApp({
      topology: topology({ one: { modules: ["a", "b"], adapter: "node" } }),
      deployable: "one",
      routes: routesOf("both"),
      ctx: ctxX,
      mode: "production",
      secret: SECRET,
      identity: idOf(identifiedX, "browser"),
    });
    return { x: one, y: one, ctxX, ctxY, seenB, identifiedX, identifiedY, captured, makeY: undefined };
  }
  const t = topology({ x: { modules: ["a"], adapter: "node" }, y: { modules: ["b"], adapter: "node" } });
  const makeY = (secret: string) =>
    createApp({
      topology: t,
      deployable: "y",
      routes: routesOf("b"),
      ctx: ctxY,
      mode: "production",
      secret,
      identity: idOf(identifiedY, o.yAnswer ?? "anon-y"),
    });
  const y = await makeY(SECRET);
  ctxX.net.route("http://y.test/*", (req) => {
    captured.push({ method: req.method, url: req.url, header: req.headers.get("x-keel-user") });
    return y.fetch(req);
  });
  const x = await createApp({
    topology: t,
    deployable: "x",
    routes: routesOf("a"),
    ctx: ctxX,
    mode: "production",
    secret: SECRET,
    peers: { y: "http://y.test" },
    artifacts,
    identity: idOf(identifiedX, "browser"),
  });
  return { x, y, ctxX, ctxY, seenB, identifiedX, identifiedY, captured, makeY };
}

const getB = (n: string, headers: Record<string, string> = {}) =>
  new Request(`http://localhost/b/${n}`, { headers: { accept: "application/json", ...headers } });

describe("k.user: user across deployables", () => {
  test("`service({ module: 'b' })` with `user: 'u1'`, in process and split: `b`'s loader gets `'u1'` and `b`'s `identify` is not called", async () => {
    await fc.assert(
      fc.asyncProperty(userArb, fc.boolean(), async (u, split) => {
        const t = await bed({ split, user: u });
        const res = await t.x.fetch(new Request("http://localhost/a/1", { headers: { accept: "application/json" } }));
        expect(res.status).toBe(200);
        expect(t.seenB.get).toEqual([u]);
        expect(t.identifiedX).toHaveLength(1);
        expect(t.identifiedY).toHaveLength(0);
        if (split) expect(t.captured).toHaveLength(1);
      }),
      { seed: SEED, numRuns: 12 },
    );
  });

  test("a module call without `user` sends no `x-keel-user`, and `b`'s `identify` runs for it", async () => {
    const t = await bed({ split: true, user: undefined, yAnswer: "anon-y" });
    expect(
      (await t.x.fetch(new Request("http://localhost/a/1", { headers: { accept: "application/json" } }))).status,
    ).toBe(200);
    expect(t.captured).toHaveLength(1);
    expect(t.captured[0]?.header).toBeNull();
    expect(t.identifiedY).toHaveLength(1);
    expect(t.seenB.get).toEqual(["anon-y"]);
  });

  test("that header resent within its window to the same method, path and search is used as `user`; resent after 61 s it is ignored and `identify` runs", async () => {
    const t = await bed({ split: true, user: "u1", yAnswer: "anon-y" });
    await t.x.fetch(new Request("http://localhost/a/1", { headers: { accept: "application/json" } }));
    const header = t.captured[0]?.header ?? "";
    expect(header).not.toBe("");
    t.seenB.get.length = 0;
    const within = await t.y.fetch(getB("1", { "x-keel-user": header }));
    expect(within.status).toBe(200);
    expect(t.seenB.get).toEqual(["u1"]);
    expect(t.identifiedY).toHaveLength(0);
    t.ctxY.clock.advance(61_000);
    await t.y.fetch(getB("1", { "x-keel-user": header }));
    expect(t.seenB.get).toEqual(["u1", "anon-y"]);
    expect(t.identifiedY).toHaveLength(1);
  });

  test("that header resent to another path, another method or another search is ignored and `identify` runs", async () => {
    await fc.assert(
      fc.asyncProperty(fc.stringMatching(/^[a-z0-9]{1,6}$/), async (other) => {
        const t = await bed({ split: true, user: "u1", yAnswer: "anon-y" });
        await t.x.fetch(new Request("http://localhost/a/1", { headers: { accept: "application/json" } }));
        const header = t.captured[0]?.header ?? "";
        t.seenB.get.length = 0;
        await t.y.fetch(getB(`z${other}`, { "x-keel-user": header }));
        await t.y.fetch(
          new Request("http://localhost/b/1?q=1", { headers: { accept: "application/json", "x-keel-user": header } }),
        );
        expect(t.seenB.get).toEqual(["anon-y", "anon-y"]);
        await t.y.fetch(
          new Request("http://localhost/b/1", {
            method: "POST",
            body: "{}",
            headers: {
              accept: "application/json",
              "content-type": "application/json",
              origin: "http://localhost",
              "x-keel-user": header,
            },
          }),
        );
        expect(t.seenB.put).toEqual(["anon-y"]);
        expect(t.identifiedY).toHaveLength(3);
      }),
      { seed: SEED, numRuns: 5 },
    );
  });

  test("that header with one changed character is ignored and `identify` runs", async () => {
    const t = await bed({ split: true, user: "u1", yAnswer: "anon-y" });
    await t.x.fetch(new Request("http://localhost/a/1", { headers: { accept: "application/json" } }));
    const header = t.captured[0]?.header ?? "";
    expect(header.length).toBeGreaterThan(2);
    await fc.assert(
      fc.asyncProperty(fc.nat({ max: header.length - 2 }), async (i) => {
        const was = header[i] ?? "a";
        const swapped = `${header.slice(0, i)}${was === "A" ? "B" : "A"}${header.slice(i + 1)}`;
        t.seenB.get.length = 0;
        await t.y.fetch(getB("1", { "x-keel-user": swapped }));
        expect(t.seenB.get).toEqual(["anon-y"]);
      }),
      { seed: SEED, numRuns: 30 },
    );
  });

  test("a header another secret signed is ignored and `identify` runs", async () => {
    const t = await bed({ split: true, user: "u1", yAnswer: "anon-y" });
    await t.x.fetch(new Request("http://localhost/a/1", { headers: { accept: "application/json" } }));
    const header = t.captured[0]?.header ?? "";
    const other = await t.makeY?.("another-secret-fedcba9876543210fedcba9876543210fedcba98");
    const res = await other?.fetch(getB("1", { "x-keel-user": header }));
    expect(res?.status).toBe(200);
    expect(t.seenB.get.at(-1)).toBe("anon-y");
  });

  test("A forwarded request keeps its headers, so the peer runs its own `identify` and the sender's is not called", async () => {
    await fc.assert(
      fc.asyncProperty(userArb, async (cookie) => {
        const t = await bed({ split: true, user: "u1", yCookie: true });
        const res = await t.x.fetch(
          new Request("http://localhost/b/1", {
            headers: { accept: "application/json", cookie: `sid=${cookie}`, "x-keel-user": "u9" },
          }),
        );
        expect(res.status).toBe(200);
        expect(t.identifiedX).toHaveLength(0);
        expect(t.identifiedY).toHaveLength(1);
        expect(t.identifiedY[0]?.headers.get("cookie")).toBe(`sid=${cookie}`);
        expect(t.seenB.get).toEqual([`sid=${cookie}`]);
      }),
      { seed: SEED, numRuns: 10 },
    );
  });

  test("on a ctx with no secret, a `service({ module })` call with `user` is `api.input` and sends no request", async () => {
    await fc.assert(
      fc.asyncProperty(userArb, async (u) => {
        const ctx = createCtx({ mode: "sim", seed: SEED });
        const sent: string[] = [];
        ctx.net.route("*", (req) => {
          sent.push(req.url);
          return new Response("{}", { status: 200 });
        });
        const r = await service({ module: "b", schema }).get({ params: { n: "1" }, user: u }, ctx);
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.error.code).toBe("api.input");
        expect(sent).toEqual([]);
      }),
      { seed: SEED, numRuns: 10 },
    );
  });
});
