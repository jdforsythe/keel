// Spec: k.security, Conformance "The 101st report within 60 s of the sim clock is not logged; one `csp` record with `dropped: 1` follows the window; a 17 KiB body is 413 and logs nothing."
// Seed: 1337.
// @vitest-environment happy-dom
import { createCtx } from "@keel/ctx";
import { manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { createApp, topology } from "@keel/server";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { flush } from "./topology-fixtures.ts";

async function setup() {
  const lines: string[] = [];
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  const appContract = contract("app", { "app.home": { path: "/" } });
  const app = await createApp({
    topology: topology({ web: { modules: ["app"], adapter: "node" } }),
    routes: manifest(appContract, { "app.home": { component: () => document.createElement("main") } }),
    ctx,
    mode: "production",
    log: { format: "json", write: (line) => lines.push(line) },
  });
  const csp = (): Record<string, unknown>[] => {
    const out: Record<string, unknown>[] = [];
    for (const l of lines) {
      const v: unknown = JSON.parse(l);
      if (typeof v === "object" && v !== null && "kind" in v && v.kind === "csp")
        out.push(Object.fromEntries(Object.entries(v)));
    }
    return out;
  };
  return { app, ctx, csp };
}

const body = JSON.stringify({
  "csp-report": {
    "document-uri": "http://localhost/",
    "violated-directive": "img-src",
    "blocked-uri": "https://cdn.example/a.png",
  },
});
const post = (app: { fetch(r: Request): Promise<Response> }, b: string): Promise<Response> =>
  app.fetch(
    new Request("http://localhost/__keel/csp", {
      method: "POST",
      body: b,
      headers: { "content-type": "application/csp-report" },
    }),
  );

describe("k.security: report window", () => {
  test("The 101st report within 60 s of the sim clock is not logged", async () => {
    const { app, csp } = await setup();
    for (let i = 0; i < 101; i++) {
      const res = await post(app, body);
      expect(res.status).toBe(204);
    }
    expect(csp().filter((r) => r["dropped"] === undefined)).toHaveLength(100);
  });

  test("one `csp` record with `dropped: 1` follows the window", async () => {
    const { app, ctx, csp } = await setup();
    for (let i = 0; i < 101; i++) await post(app, body);
    expect(csp().some((r) => r["dropped"] !== undefined)).toBe(false);
    ctx.clock.advance(60_000);
    await flush();
    const dropped = csp().filter((r) => r["dropped"] !== undefined);
    expect(dropped).toEqual([{ kind: "csp", dropped: 1 }]);
  });

  test("property: past 100 reports in the window the rest are counted, and the window's end writes `dropped: n - 100`", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 101, max: 130 }), async (n) => {
        const { app, ctx, csp } = await setup();
        for (let i = 0; i < n; i++) await post(app, body);
        expect(csp().filter((r) => r["dropped"] === undefined)).toHaveLength(100);
        ctx.clock.advance(60_000);
        await flush();
        expect(csp().filter((r) => r["dropped"] !== undefined)).toEqual([{ kind: "csp", dropped: n - 100 }]);
      }),
      { seed: 1337, numRuns: 8 },
    );
  });

  test("a window that saw no more than 100 reports writes no `dropped` record", async () => {
    const { app, ctx, csp } = await setup();
    for (let i = 0; i < 100; i++) await post(app, body);
    ctx.clock.advance(60_000);
    await flush();
    expect(csp().filter((r) => r["dropped"] !== undefined)).toEqual([]);
  });

  test("a 17 KiB body is 413 and logs nothing", async () => {
    const { app, csp } = await setup();
    const big = JSON.stringify({
      "csp-report": { "document-uri": "http://localhost/", "blocked-uri": "x".repeat(17 * 1024) },
    });
    expect(new TextEncoder().encode(big).length).toBeGreaterThan(16 * 1024);
    const res = await post(app, big);
    expect(res.status).toBe(413);
    expect(csp()).toEqual([]);
  });
});
