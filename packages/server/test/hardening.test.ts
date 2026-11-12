import { originListed as originMatches } from "@keel/compiler/inspect/originListed";
// RFC 0022 server hardening under plain Node (happy-dom strips `Origin` and `Sec-*` request headers): the production
// default, the CSRF accept/reject matrix for writes, `_method` from POST only, dev inspect origin and host gating,
// prototype-safe submitted values, and per-request store registries (overlapping requests, one store id).
import { createCtx } from "@keel/ctx";
import { action, manifest } from "@keel/router";
import { ok, s } from "@keel/schema";
import { store, stores } from "@keel/store";
import { describe, expect, it } from "vitest";
import { createApp, topology } from "../src/index.ts";
import { valuesOf } from "../src/internal/valuesOf.ts";

const BASE = "http://localhost";
const INSPECT = `${BASE}/__keel/inspect`;
const Note = s.object({ note: s.string() });
const Draft = s.object({ text: s.string() });

type Calls = { verbs: string[] };

type Extra = { mode?: "dev" | "production"; origins?: string[]; overlap?: { started(): void; gate: Promise<void> } };

function build(calls: Calls, extra: Extra = {}) {
  const act = (verb: string) =>
    action({ input: Note }, async (input) => {
      calls.verbs.push(verb);
      if (input.note === "boom") throw new Error("secret-detail");
      const overlap = extra.overlap;
      if (overlap !== undefined) {
        // Created synchronously in the request scope, then held live across an await by the other request.
        store(Draft, { text: input.note }, { id: "app.draft" });
        overlap.started();
        await overlap.gate;
      }
      return ok(null);
    });
  const routes = manifest({
    "app.notes": {
      path: "/notes",
      component: () => {
        throw new Error("not rendered under node");
      },
    },
  });
  routes.actions({ "app.notes": { POST: act("POST"), PUT: act("PUT"), PATCH: act("PATCH"), DELETE: act("DELETE") } });
  return createApp({
    topology: topology({ web: { modules: ["app"], adapter: "node" } }),
    routes,
    ctx: createCtx({ mode: "sim", seed: 1337 }),
    ...(extra.mode === undefined ? {} : { mode: extra.mode }),
    ...(extra.origins === undefined ? {} : { inspect: { origins: extra.origins } }),
  });
}

const form = (fields: Record<string, string>): FormData => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
};
const write = (method: string, headers: Record<string, string>, fields: Record<string, string> = { note: "hi" }) =>
  new Request(`${BASE}/notes`, { method, headers, body: form(fields) });
const body = async (r: Response): Promise<unknown> => JSON.parse(await r.text());

describe("production default", () => {
  it("createApp without `mode` scrubs an uncaught throw and does not serve inspect", async () => {
    const app = await build({ verbs: [] });
    const res = await app.fetch(write("POST", { accept: "application/json", "x-keel": "1" }, { note: "boom" }));
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).not.toContain("secret-detail");
    expect(text).toContain("unexpected");
    const inspect = await app.fetch(new Request(INSPECT, { headers: { accept: "application/json" } }));
    expect(inspect.status).toBe(404);
  });
});

describe("CSRF: writes must be same-site", () => {
  const evil = "https://evil.example";
  const accepted: [string, Record<string, string>][] = [
    ["no Origin, no Sec-Fetch-Site (not a browser)", {}],
    ["Sec-Fetch-Site same-origin", { "sec-fetch-site": "same-origin" }],
    ["Sec-Fetch-Site none", { "sec-fetch-site": "none" }],
    ["Origin equal to the request origin", { origin: BASE }],
    ["same Origin with Sec-Fetch-Site cross-site", { origin: BASE, "sec-fetch-site": "cross-site" }],
  ];
  const rejected: [string, Record<string, string>][] = [
    ["a foreign Origin", { origin: evil }],
    ["Origin null", { origin: "null" }],
    ["another port of the same host", { origin: "http://localhost:9999" }],
    ["Sec-Fetch-Site cross-site", { "sec-fetch-site": "cross-site" }],
    ["Sec-Fetch-Site same-site", { "sec-fetch-site": "same-site" }],
    ["x-keel without accept: application/json", { origin: evil, "x-keel": "1" }],
    ["accept: application/json without x-keel", { origin: evil, accept: "application/json" }],
    ["x-keel other than 1", { origin: evil, accept: "application/json", "x-keel": "yes" }],
  ];

  for (const [name, headers] of accepted)
    it(`accepts ${name}: the document POST runs and redirects 303`, async () => {
      const calls = { verbs: [] };
      const res = await (await build(calls)).fetch(write("POST", headers));
      expect(res.status).toBe(303);
      expect(calls.verbs).toEqual(["POST"]);
    });

  for (const [name, headers] of rejected)
    it(`rejects ${name}: 403 keel.denied, the action does not run`, async () => {
      const calls = { verbs: [] };
      const res = await (await build(calls)).fetch(write("POST", headers));
      expect(res.status).toBe(403);
      expect(res.headers.get("cache-control")).toBe("no-store");
      expect(await body(res)).toMatchObject({ ok: false, error: { code: "keel.denied" } });
      expect(calls.verbs).toEqual([]);
    });

  it("accepts a cross-origin runtime request carrying accept: application/json and x-keel: 1", async () => {
    const calls = { verbs: [] };
    const res = await (await build(calls)).fetch(
      write("POST", { origin: evil, accept: "application/json", "x-keel": "1" }),
    );
    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ ok: true, value: null });
    expect(calls.verbs).toEqual(["POST"]);
  });

  it("checks PUT, PATCH, DELETE and a POST `_method` override alike", async () => {
    const calls = { verbs: [] };
    const app = await build(calls);
    for (const m of ["PUT", "PATCH", "DELETE"]) expect((await app.fetch(write(m, { origin: evil }))).status).toBe(403);
    expect((await app.fetch(write("POST", { origin: evil }, { note: "x", _method: "DELETE" }))).status).toBe(403);
    expect(calls.verbs).toEqual([]);
  });

  it("leaves GET alone: a cross-origin read is not a write", async () => {
    const app = await build({ verbs: [] });
    const res = await app.fetch(
      new Request(`${BASE}/notes`, { headers: { origin: evil, accept: "application/json" } }),
    );
    expect(res.status).toBe(200);
  });

  it("`_method` overrides POST only: a PUT carrying `_method=DELETE` runs the PUT action", async () => {
    const calls = { verbs: [] };
    const app = await build(calls);
    expect((await app.fetch(write("PUT", { origin: BASE }, { note: "x", _method: "DELETE" }))).status).toBe(303);
    expect((await app.fetch(write("POST", { origin: BASE }, { note: "x", _method: "DELETE" }))).status).toBe(303);
    expect(calls.verbs).toEqual(["PUT", "DELETE"]);
  });
});

describe("dev inspect gating", () => {
  const read = async (url: string, headers: Record<string, string>, origins?: string[]) =>
    (await build({ verbs: [] }, { mode: "dev", ...(origins === undefined ? {} : { origins }) })).fetch(
      new Request(url, { headers }),
    );

  it("answers same-origin and Origin-less reads without CORS headers", async () => {
    for (const headers of [{}, { origin: BASE }]) {
      const res = await read(INSPECT, headers);
      expect(res.status).toBe(200);
      expect(res.headers.get("access-control-allow-origin")).toBeNull();
    }
  });

  it("refuses other origins by default, loopback ports included", async () => {
    for (const origin of ["http://localhost:9999", "http://127.0.0.1:5173", "https://evil.example"]) {
      const res = await read(INSPECT, { origin });
      expect(res.status).toBe(403);
      expect(res.headers.get("access-control-allow-origin")).toBeNull();
      expect(await body(res)).toMatchObject({ ok: false, error: { code: "keel.denied" } });
    }
  });

  it("answers listed origins (`:*` for any port) and echoes them for CORS", async () => {
    const res = await read(INSPECT, { origin: "http://localhost:4182" }, ["http://localhost:*"]);
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:4182");
    expect(res.headers.get("vary")).toBe("origin");
    expect((await read(INSPECT, { origin: "http://localhost.evil:1" }, ["http://localhost:*"])).status).toBe(403);
  });

  it("refuses a non-loopback, unlisted host (DNS rebinding) even without Origin", async () => {
    expect((await read("http://rebound.example/__keel/inspect", {})).status).toBe(403);
    expect((await read("http://dev.box:5173/__keel/inspect", {}, ["http://dev.box:5173"])).status).toBe(200);
  });

  it("POST to the inspect path needs a loopback or listed Origin: none is 403, same-origin keeps the route table", async () => {
    const app = await build({ verbs: [] }, { mode: "dev" });
    const post = (headers: Record<string, string>) => app.fetch(new Request(INSPECT, { method: "POST", headers }));
    const none = await post({});
    expect(none.status).toBe(403);
    expect(await body(none)).toMatchObject({ ok: false, error: { code: "keel.denied" } });
    expect((await post({ origin: BASE })).status).toBe(404);
    expect((await post({ origin: "http://localhost:9999" })).status).toBe(403);
    expect((await post({ origin: "https://evil.example" })).status).toBe(403);
    expect((await read(INSPECT, {})).status).toBe(200);
  });

  it("a cross-site POST to the inspect path is refused like any write", async () => {
    const app = await build({ verbs: [] }, { mode: "dev" });
    const res = await app.fetch(new Request(INSPECT, { method: "POST", headers: { origin: "https://evil.example" } }));
    expect(res.status).toBe(403);
  });

  it("originMatches: exact entries, and `:*` matching the bare origin or a numeric port only", () => {
    expect(originMatches(["http://a.test"], "http://a.test")).toBe(true);
    expect(originMatches(["http://a.test"], "http://a.test:1")).toBe(false);
    expect(originMatches(["http://a.test:*"], "http://a.test")).toBe(true);
    expect(originMatches(["http://a.test:*"], "http://a.test:65535")).toBe(true);
    expect(originMatches(["http://a.test:*"], "http://a.test:x")).toBe(false);
    expect(originMatches(["http://a.test:*"], "http://a.test.evil:1")).toBe(false);
  });
});

describe("submitted values", () => {
  it("drop __proto__, constructor and prototype; a repeated __proto__ cannot set the prototype", () => {
    const fd = form({ note: "a" });
    fd.append("__proto__", "x");
    fd.append("__proto__", "y");
    fd.append("constructor", "c");
    fd.append("prototype", "p");
    fd.append("tag", "1");
    fd.append("tag", "2");
    const v = valuesOf(fd, s.object({}).node);
    expect(Object.getPrototypeOf(v)).toBe(Object.prototype);
    expect(Object.keys(v)).toEqual(["note", "tag"]);
    expect(v).toEqual({ note: "a", tag: ["1", "2"] });
  });
});

describe("per-request store registries", () => {
  it("two overlapping requests that create the same store id both succeed, and neither leaks into the module", async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    let started = 0;
    const calls = { verbs: [] };
    const app = await build(calls, { overlap: { gate, started: () => void (++started === 2 && release()) } });
    const headers = { accept: "application/json", "x-keel": "1", "content-type": "application/json" };
    const send = (note: string) =>
      app.fetch(new Request(`${BASE}/notes`, { method: "POST", headers, body: JSON.stringify({ note }) }));
    const [a, b] = await Promise.all([send("one"), send("two")]);
    expect(started).toBe(2);
    expect([a.status, b.status]).toEqual([200, 200]);
    expect(calls.verbs).toEqual(["POST", "POST"]);
    expect(stores().has("app.draft")).toBe(false);
  });
});
