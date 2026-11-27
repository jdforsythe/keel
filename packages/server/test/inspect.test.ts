// @vitest-environment happy-dom
// The dev inspect route of createApp (k.cli Inspect, RFC 0017): live graph and stores of the process, artifacts
// from the `.keel` directory, CORS only for an admitted origin, absent in production, one `req` record per request.
import fs from "node:fs";
import path from "node:path";
import { createCtx } from "@keel/ctx";
import { scope } from "@keel/reactive";
import { manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { s } from "@keel/schema";
import { store, transaction, tx } from "@keel/store";
import { tempDir } from "@keel/tooling/test-tmp";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp, topology } from "../src/index.ts";
import { inspectResponse } from "../src/internal/inspectResponse.ts";

const BASE = "http://localhost";
const Counter = s.object({ n: s.int() });
const c = contract("orders", { "orders.list": { path: "/orders" } });
const routes = manifest(c, { "orders.list": { component: () => document.createElement("p") } });

let dir = "";
beforeEach(() => {
  dir = tempDir("keel-inspect-");
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

const build = (mode: "dev" | "production", lines: string[], artifacts?: string) =>
  createApp({
    topology: topology({ web: { modules: ["orders"], adapter: "node" } }),
    routes,
    ctx: createCtx({ mode: "sim", seed: 1337 }),
    mode,
    log: { format: "compact", write: (l) => void lines.push(l) },
    ...(artifacts === undefined ? {} : { artifacts }),
  });

const json = async (r: Response): Promise<Record<string, unknown>> => {
  const v: unknown = await r.json();
  return typeof v === "object" && v !== null ? Object.fromEntries(Object.entries(v)) : {};
};

describe("GET /__keel/inspect", () => {
  it("dev: every live store's state and log, the inspect() graph, artifacts from the directory", async () => {
    fs.writeFileSync(path.join(dir, "ids.json"), JSON.stringify({ data: { "orders.x": { tag: "p" } }, hash: "h" }));
    fs.writeFileSync(path.join(dir, "a11y.json"), "{");
    const h = scope(
      () => {
        const counter = store(Counter, { n: 0 }, { id: "orders.inspectCounter" });
        const bump = transaction(counter, "orders.bump", s.object({ by: s.int() }), (st, p) => ({ n: st.n + p.by }));
        tx(bump, { by: 2 });
      },
      { detached: true },
    );
    const lines: string[] = [];
    const app = await build("dev", lines, dir);
    const res = await app.fetch(new Request(`${BASE}/__keel/inspect`));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const doc = await json(res);
    expect(doc.live).toBe(true);
    expect(doc.stores).toMatchObject({
      "orders.inspectCounter": { state: { n: 2 }, log: [{ name: "orders.bump", payload: { by: 2 } }] },
    });
    expect(doc.graph).toMatchObject({ nodes: expect.arrayContaining([{ id: expect.any(Number), kind: "scope" }]) });
    expect(doc.ids).toEqual({ "orders.x": { tag: "p" } });
    expect(doc.a11y).toEqual({});
    expect(doc.routes).toEqual({});
    expect(lines).toEqual(["GET /__keel/inspect 200 0ms"]);
    h.dispose();
    const after = await json(await app.fetch(new Request(`${BASE}/__keel/inspect`)));
    expect(Object.keys(after.stores ?? {})).not.toContain("orders.inspectCounter");
  });

  it("dev without artifacts: ids, a11y, routes are {}", async () => {
    const doc = await json(await (await build("dev", [])).fetch(new Request(`${BASE}/__keel/inspect`)));
    expect([doc.ids, doc.a11y, doc.routes]).toEqual([{}, {}, {}]);
  });

  it("echoes only the origin the gate admitted (gating itself: hardening.test.ts, under Node)", async () => {
    // `origin` is a forbidden request header in the DOM environment, so the response builder is called directly.
    const { response: res } = await inspectResponse(
      undefined,
      "http://localhost:4182",
      createCtx({ mode: "sim", seed: 1 }),
    );
    expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:4182");
    expect(res.headers.get("vary")).toBe("origin");
    expect(
      (await inspectResponse(undefined, undefined, createCtx({ mode: "sim", seed: 1 }))).response.headers.get(
        "access-control-allow-origin",
      ),
    ).toBeNull();
  });

  it("production: the route table's 404; a dev POST without an Origin is 403 (gating: hardening.test.ts)", async () => {
    const lines: string[] = [];
    expect((await (await build("production", lines)).fetch(new Request(`${BASE}/__keel/inspect`))).status).toBe(404);
    const dev = await build("dev", []);
    expect((await dev.fetch(new Request(`${BASE}/__keel/inspect`, { method: "POST" }))).status).toBe(403);
    expect(lines).toEqual(["GET /__keel/inspect 404 0ms"]);
  });
});
