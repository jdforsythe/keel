// @vitest-environment happy-dom
// k.privacy Sinks, the `req` path: where the line-up rule over-marks, an encoded separator, and a `.pii()` param. Seed 1337.
import { createCtx } from "@keel/ctx";
import { type RouteDef, manifest } from "@keel/router";
import { compileRoutes, compileTable } from "@keel/router/internal";
import { s } from "@keel/schema";
import { describe, expect, it, test } from "vitest";
import { createApp, topology } from "../src/index.ts";
import { secretSegments } from "../src/internal/secretSegments.ts";

const SEED = 1337;
const view = (): Node => document.createElement("main");
const marksOf = (routes: Record<string, RouteDef>) => secretSegments(compileTable(compileRoutes(routes), routes));
const tok = s.secret(s.string());

describe("a route led by a param", () => {
  it("marks the first segment of every path when the lead param is the secret", () => {
    const one = marksOf({ "app.t": { path: "/:token", params: s.object({ token: tok }), component: view } });
    expect(one("/about")).toBe("/[secret]");
    expect(one("/about/team")).toBe("/[secret]");
    const two = marksOf({
      "app.t": { path: "/:lang/:token", params: s.object({ lang: s.string(), token: tok }), component: view },
    });
    expect(two("/about")).toBe("/[secret]");
    expect(two("/en/A")).toBe("/[secret]");
  });

  it("cuts at the first segment when a lead param precedes the secret, the path read without the lead too", () => {
    const marks = marksOf({
      "app.t": { path: "/:p/:tok", params: s.object({ p: s.string(), tok }), component: view },
    });
    expect(marks("/en/A")).toBe("/[secret]");
    expect(marks("/A")).toBe("/[secret]");
  });
});

describe("an encoded separator", () => {
  test("before the secret marks the segment that holds it", () => {
    const marks = marksOf({ "app.r": { path: "/reset/:token", params: s.object({ token: tok }), component: view } });
    for (const p of ["/reset%2FSECRETx", "/reset%2fSECRETx", "/RESET%2FSECRETx", "/reset%5CSECRETx"])
      expect(marks(p)).toBe("/[secret]");
  });
});

describe("a personal-data route param", () => {
  test("is [pii] in the req path", async () => {
    const lines: string[] = [];
    const app = await createApp({
      topology: topology({ web: { modules: ["app"], adapter: "node" } }),
      routes: manifest({
        "app.who": { path: "/u/:email", params: s.object({ email: s.string().pii("contact") }), component: view },
      }),
      ctx: createCtx({ mode: "sim", seed: SEED }),
      mode: "production",
      log: { format: "compact", write: (l) => void lines.push(l) },
    });
    for (const p of ["/u/alice@example.com", "/u/alice%40example.com"])
      await (await app.fetch(new Request(`http://localhost${p}`))).text();
    await app.close();
    expect(lines.filter((l) => l.startsWith("GET "))).toEqual([
      expect.stringMatching(/^GET \/u\/\[pii\] app\.who 200/),
      expect.stringMatching(/^GET \/u\/\[pii\] app\.who 200/),
    ]);
  });
});
