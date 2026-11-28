// Spec: k.user, clause "A `service({ contract: b })` header for `user: 'u1'` resent with another body or to deployable `c`, or signed 66 s ahead, is ignored and `identify` runs; resent unchanged within 60 s, `'u1'`. A 257-character `user`: `api.input` at the sender, ignored by the receiver."
// k.user, User header "The `x-keel-user` MAC also covers the body's SHA-256 (of no bytes for none) and the receiving deployable's name (`createApp({ deployable })`, else `''`). A sender answers `api.input` for a `user` over 256 characters or a stream body. A receiver ignores it on a MAC mismatch, an expiry over 65 s ahead of its `ctx.clock`, or such a `user`. It is no sign-in credential: an assertion between the app's own deployables, never sent to a browser; until it expires it replays that one request, and plain `http` between peers exposes it."
// Seed 1337 (fc.assert below). Split topology as identity-peers.test.ts (`x` runs module `a`, `y` runs `b`) plus a third deployable `c` under the same secret; the sim net routes `http://y.test` to `y`.
// Every header here is one captured from a real call, except the receiver half of the 257-character clause, which signs by hand (below).
// Untestable through the public API: the stream-body half of "A sender answers `api.input` for ... a stream body": a client method's `body` is JSON by its schema, so no typed call can carry a stream. "It is no sign-in credential ... never sent to a browser": prose with no observable of its own.
// @vitest-environment node
import { createHash, createHmac } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createCtx } from "@keel/ctx";
import { action, loader, manifest, routesArtifact } from "@keel/router";
import { contract } from "@keel/router/contract";
import { err, ok, s } from "@keel/schema";
import { createApp, identity, topology } from "@keel/server";
import { service } from "@keel/services";
import fc from "fast-check";
import { describe, expect, test } from "vitest";

const SEED = 1337;
const SECRET = "conformance-secret-user-0123456789abcdef0123456789abcdef";
const ORIGIN = { origin: "http://localhost" };

const Params = s.object({ n: s.string() });
const Item = s.object({ n: s.string(), user: s.string() });
const Boom = s.error("a.boom", s.object({}));
const Put = s.object({ k: s.string() });
const bContract = contract("b", {
  "b.get": { method: "GET", path: "/b/:n", params: Params, output: Item },
  "b.put": { method: "POST", path: "/b/:n", params: Params, body: Put, output: s.string().nullable() },
});
const cContract = contract("c", {
  "c.get": { method: "GET", path: "/b/:n", params: Params, output: Item },
  "c.put": { method: "POST", path: "/b/:n", params: Params, body: Put, output: s.string().nullable() },
});
const view = () => document.createElement("main");

interface Captured {
  readonly method: string;
  readonly url: string;
  readonly header: string | null;
  readonly body: string;
}

async function bed(o: { user: string; via: "get" | "put"; body?: string }) {
  const seenB: { get: string[]; put: string[] } = { get: [], put: [] };
  const seenC: string[] = [];
  const identifiedY: Request[] = [];
  const identifiedC: Request[] = [];
  const outcomes: string[] = [];
  const api = service({ contract: bContract });
  const aContract = contract("a", { "a.show": { path: "/a/:n", params: Params } });
  const aShow = loader(aContract, "a.show", { output: Item }, async ({ params }, ctx) => {
    const r =
      o.via === "get"
        ? await api.get({ params, user: o.user }, ctx)
        : await api.put({ params, body: { k: o.body ?? "one" }, user: o.user }, ctx);
    outcomes.push(r.ok ? "ok" : r.error.code);
    return r.ok ? ok({ n: params.n, user: o.user }) : err(Boom.make({}));
  });
  const bGet = loader(bContract, "b.get", {}, async ({ params, user }) => {
    seenB.get.push(user);
    return ok({ n: params.n, user });
  });
  const bPut = action(bContract, "b.put", {}, async (_body, { user }) => {
    seenB.put.push(user);
    return ok(null);
  });
  const cGet = loader(cContract, "c.get", {}, async ({ params, user }) => {
    seenC.push(user);
    return ok({ n: params.n, user });
  });
  const routesB = () => {
    const m = manifest(bContract, { "b.get": { loader: bGet }, "b.put": { action: bPut } });
    return m;
  };
  const cPut = action(cContract, "c.put", {}, async (_body, { user }) => {
    seenC.push(user);
    return ok(null);
  });
  const routesC = () => {
    const m = manifest(cContract, { "c.get": { loader: cGet }, "c.put": { action: cPut } });
    return m;
  };
  const idOf = (log: Request[], answer: string) =>
    identity({
      identify: async ({ request }) => {
        log.push(request);
        return answer;
      },
    });
  const artifacts = fs.mkdtempSync(path.join(os.tmpdir(), "keel-user-binding-"));
  fs.writeFileSync(path.join(artifacts, "routes.json"), JSON.stringify({ data: routesArtifact(routesB()), hash: "" }));
  const captured: Captured[] = [];
  const ctxX = createCtx({ mode: "sim", seed: SEED });
  const ctxY = createCtx({ mode: "sim", seed: SEED });
  const ctxC = createCtx({ mode: "sim", seed: SEED });
  const t = topology({
    x: { modules: ["a"], adapter: "node" },
    y: { modules: ["b"], adapter: "node" },
    c: { modules: ["c"], adapter: "node" },
  });
  const y = await createApp({
    topology: t,
    deployable: "y",
    routes: routesB(),
    ctx: ctxY,
    mode: "production",
    secret: SECRET,
    identity: idOf(identifiedY, "anon-y"),
  });
  const c = await createApp({
    topology: t,
    deployable: "c",
    routes: routesC(),
    ctx: ctxC,
    mode: "production",
    secret: SECRET,
    identity: idOf(identifiedC, "anon-c"),
  });
  ctxX.net.route("http://y.test/*", async (req) => {
    captured.push({
      method: req.method,
      url: req.url,
      header: req.headers.get("x-keel-user"),
      body: await req.clone().text(),
    });
    return y.fetch(req);
  });
  const x = await createApp({
    topology: t,
    deployable: "x",
    routes: manifest(aContract, { "a.show": { component: view, loader: aShow } }),
    ctx: ctxX,
    mode: "production",
    secret: SECRET,
    peers: { y: "http://y.test" },
    artifacts,
    identity: idOf([], "browser"),
  });
  const call = async () => {
    await x.fetch(new Request("http://localhost/a/1", { headers: { accept: "application/json" } }));
    return captured[0];
  };
  return { x, y, c, ctxX, ctxY, seenB, seenC, identifiedY, identifiedC, outcomes, captured, call };
}

const getB = (headers: Record<string, string>) =>
  new Request("http://localhost/b/1", { headers: { accept: "application/json", ...headers } });
const putB = (header: string, body: string) =>
  new Request("http://localhost/b/1", {
    method: "POST",
    body,
    headers: { accept: "application/json", "content-type": "application/json", ...ORIGIN, "x-keel-user": header },
  });
const postC = (header: string, body: string) =>
  new Request("http://localhost/b/1", {
    method: "POST",
    body,
    headers: { accept: "application/json", "content-type": "application/json", ...ORIGIN, "x-keel-user": header },
  });

describe("k.user: the user header binds the body, the deployable and an expiry ceiling", () => {
  test("a `service({ contract: b })` header for `user: 'u1'` resent unchanged within 60 s, body included, is `'u1'` and `identify` does not run", async () => {
    await fc.assert(
      fc.asyncProperty(fc.stringMatching(/^[a-z0-9]{1,12}$/), fc.integer({ min: 0, max: 59 }), async (k, secs) => {
        const t = await bed({ user: "u1", via: "put", body: k });
        const sent = await t.call();
        expect(sent?.method).toBe("POST");
        expect(t.outcomes).toEqual(["ok"]);
        t.seenB.put.length = 0;
        t.ctxY.clock.advance(secs * 1000);
        const res = await t.y.fetch(putB(sent?.header ?? "", sent?.body ?? ""));
        expect(res.status).toBeLessThan(400);
        expect(t.seenB.put).toEqual(["u1"]);
        expect(t.identifiedY).toHaveLength(0);
      }),
      { seed: SEED, numRuns: 8 },
    );
  });

  test("that header resent with another body is ignored and `identify` runs", async () => {
    await fc.assert(
      fc.asyncProperty(fc.stringMatching(/^[a-z0-9]{1,12}$/), async (other) => {
        const t = await bed({ user: "u1", via: "put", body: "one" });
        const sent = await t.call();
        fc.pre(other !== "one");
        t.seenB.put.length = 0;
        const res = await t.y.fetch(putB(sent?.header ?? "", JSON.stringify({ k: other })));
        expect(res.status).toBeLessThan(400);
        expect(t.seenB.put).toEqual(["anon-y"]);
        expect(t.identifiedY).toHaveLength(1);
      }),
      { seed: SEED, numRuns: 8 },
    );
  });

  test("that header resent to deployable `c` at `b`'s path, method, search and body is ignored and `c`'s `identify` runs; to `b` it is `'u1'`", async () => {
    const t = await bed({ user: "u1", via: "put", body: "one" });
    const sent = await t.call();
    const header = sent?.header ?? "";
    const body = sent?.body ?? "";
    const toC = await t.c.fetch(postC(header, body));
    expect(toC.status).toBeLessThan(500);
    expect(t.seenC).toEqual(["anon-c"]);
    expect(t.identifiedC).toHaveLength(1);
    t.seenB.put.length = 0;
    const toB = await t.y.fetch(putB(header, body));
    expect(toB.status).toBeLessThan(400);
    expect(t.seenB.put).toEqual(["u1"]);
    expect(t.identifiedY).toHaveLength(0);
  });

  test("a GET header resent to deployable `c` at `b`'s path is ignored and `c`'s `identify` runs", async () => {
    const t = await bed({ user: "u1", via: "get" });
    const sent = await t.call();
    await t.c.fetch(getB({ "x-keel-user": sent?.header ?? "" }));
    expect(t.seenC).toEqual(["anon-c"]);
    expect(t.identifiedC).toHaveLength(1);
  });

  test("a header signed 66 s ahead of the receiver's clock is ignored and `identify` runs", async () => {
    const t = await bed({ user: "u1", via: "get" });
    t.ctxX.clock.advance(66_000);
    const sent = await t.call();
    expect(t.outcomes).toEqual(["ok"]);
    expect(sent?.header ?? "").not.toBe("");
    expect(t.seenB.get).toEqual(["anon-y"]);
    expect(t.identifiedY).toHaveLength(1);
  });

  test("a header signed 5 s ahead of the receiver's clock (an expiry 65 s ahead) is `'u1'`", async () => {
    const t = await bed({ user: "u1", via: "get" });
    t.ctxX.clock.advance(5_000);
    await t.call();
    expect(t.seenB.get).toEqual(["u1"]);
    expect(t.identifiedY).toHaveLength(0);
  });

  test("a `user` of 256 characters is sent and used; a `user` of 257 characters is `api.input` at the sender and nothing is sent", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom("a", "é", "😀"), async (ch) => {
        const ok256 = await bed({ user: ch.repeat(256), via: "get" });
        await ok256.call();
        expect(ok256.outcomes).toEqual(["ok"]);
        expect(ok256.seenB.get).toEqual([ch.repeat(256)]);
        const over = await bed({ user: ch.repeat(257), via: "get" });
        await over.call();
        expect(over.outcomes).toEqual(["api.input"]);
        expect(over.captured).toEqual([]);
        expect(over.seenB.get).toEqual([]);
      }),
      { seed: SEED, numRuns: 3 },
    );
  });

  test("a 257-character `user` signed by hand with the fixture's secret is ignored by the receiver, where the same signing for 256 characters is used", async () => {
    const t = await bed({ user: "u1", via: "get" });
    const sent = await t.call();
    const [encUser = "", expiry = "", mac = ""] = (sent?.header ?? "").split(".");
    expect(encUser).toBe(Buffer.from("u1").toString("base64url"));
    const hex = /^[0-9a-f]{64}$/.test(mac);
    const sign = (user: string, exp: string): string => {
      const digest = createHash("sha256").update("").digest("hex");
      const m = createHmac("sha256", SECRET)
        .update(["GET", "/b/1", "", user, exp, "y", digest].join("\n"))
        .digest(hex ? "hex" : "base64url");
      return `${Buffer.from(user).toString("base64url")}.${exp}.${m}`;
    };
    // the hand signature reproduces the captured MAC, so a rejection below is the receiver's rule and not a wrong guess
    expect(sign("u1", expiry)).toBe(sent?.header);
    const at = Number(expiry);
    t.seenB.get.length = 0;
    await t.y.fetch(getB({ "x-keel-user": sign("u".repeat(256), String(at)) }));
    expect(t.seenB.get).toEqual(["u".repeat(256)]);
    await t.y.fetch(getB({ "x-keel-user": sign("u".repeat(257), String(at)) }));
    expect(t.seenB.get).toEqual(["u".repeat(256), "anon-y"]);
    expect(t.identifiedY).toHaveLength(1);
  });
});
