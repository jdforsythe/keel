// Spec: k.security, Conformance "In one window, 50 reports with `x-forwarded-for: 192.0.2.1` log 10 and a later one from `192.0.2.2` is logged; `dropped: 40` follows the window; no record holds an address."
// Seed: 1337.
// @vitest-environment happy-dom
// Skipped until the per-source cap exists.
import { createCtx } from "@keel/ctx";
import { manifest } from "@keel/router";
import { createApp, topology } from "@keel/server";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { flush } from "./topology-fixtures.ts";

async function setup() {
  const lines: string[] = [];
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  const app = await createApp({
    topology: topology({ web: { modules: ["app"], adapter: "node" } }),
    routes: manifest({ "app.home": { path: "/", component: () => document.createElement("main") } }),
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
  return { app, ctx, csp, lines };
}

const body = JSON.stringify({
  "csp-report": {
    "document-uri": "http://localhost/",
    "violated-directive": "img-src",
    "blocked-uri": "https://cdn.example/a.png",
  },
});
const post = (app: { fetch(r: Request): Promise<Response> }, from: string): Promise<Response> =>
  app.fetch(
    new Request("http://localhost/__keel/csp", {
      method: "POST",
      body,
      headers: { "content-type": "application/csp-report", "x-forwarded-for": from },
    }),
  );
const reports = (rs: Record<string, unknown>[]) => rs.filter((r) => r["dropped"] === undefined);
const droppedRecords = (rs: Record<string, unknown>[]) => rs.filter((r) => r["dropped"] !== undefined);

describe("k.security: per-source report cap", () => {
  test.skip("In one window, 50 reports with `x-forwarded-for: 192.0.2.1` log 10", async () => {
    const { app, csp } = await setup();
    for (let i = 0; i < 50; i++) expect((await post(app, "192.0.2.1")).status).toBe(204);
    expect(reports(csp())).toHaveLength(10);
  });

  test.skip("a later report from `192.0.2.2` is logged", async () => {
    const { app, csp } = await setup();
    for (let i = 0; i < 50; i++) await post(app, "192.0.2.1");
    expect((await post(app, "192.0.2.2")).status).toBe(204);
    expect(reports(csp())).toHaveLength(11);
  });

  test.skip("`dropped: 40` follows the window", async () => {
    const { app, ctx, csp } = await setup();
    for (let i = 0; i < 50; i++) await post(app, "192.0.2.1");
    await post(app, "192.0.2.2");
    expect(droppedRecords(csp())).toEqual([]);
    ctx.clock.advance(60_000);
    await flush();
    expect(droppedRecords(csp())).toEqual([{ kind: "csp", dropped: 40 }]);
  });

  test.skip("no record holds an address", async () => {
    const { app, ctx, lines } = await setup();
    for (let i = 0; i < 50; i++) await post(app, "192.0.2.1");
    await post(app, "192.0.2.2");
    ctx.clock.advance(60_000);
    await flush();
    expect(lines.length).toBeGreaterThan(0);
    for (const l of lines) {
      expect(l).not.toContain("192.0.2");
      expect(l).not.toMatch(/\b\d{1,3}(\.\d{1,3}){3}\b/);
    }
  });

  test.skip("the source is the last `x-forwarded-for` entry", async () => {
    const { app, csp } = await setup();
    for (let i = 0; i < 20; i++) await post(app, `203.0.113.9, 192.0.2.1`);
    expect(reports(csp())).toHaveLength(10);
    await post(app, "203.0.113.9, 192.0.2.2");
    expect(reports(csp())).toHaveLength(11);
  });

  test.skip("property: n reports from one source log min(n, 10); the window's end counts the rest as `dropped`", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 60 }), async (n) => {
        const { app, ctx, csp } = await setup();
        for (let i = 0; i < n; i++) await post(app, "192.0.2.1");
        expect(reports(csp())).toHaveLength(Math.min(n, 10));
        ctx.clock.advance(60_000);
        await flush();
        expect(droppedRecords(csp())).toEqual(n > 10 ? [{ kind: "csp", dropped: n - 10 }] : []);
      }),
      { seed: 1337, numRuns: 10 },
    );
  });

  test.skip("with no source (no `x-forwarded-for`), only the global 100 applies", async () => {
    const { app, csp } = await setup();
    for (let i = 0; i < 30; i++) {
      await app.fetch(
        new Request("http://localhost/__keel/csp", {
          method: "POST",
          body,
          headers: { "content-type": "application/csp-report" },
        }),
      );
    }
    expect(reports(csp())).toHaveLength(30);
  });

  test.skip("the per-source counts reset with the window", async () => {
    const { app, ctx, csp } = await setup();
    for (let i = 0; i < 12; i++) await post(app, "192.0.2.1");
    ctx.clock.advance(60_000);
    await flush();
    for (let i = 0; i < 12; i++) await post(app, "192.0.2.1");
    expect(reports(csp())).toHaveLength(20);
  });
});
