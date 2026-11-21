// @vitest-environment happy-dom
// k.privacy Sinks, the `req` path: where the line-up rule over-marks, an encoded separator, and a `.pii()` param. Seed 1337.
import { createCtx } from "@keel/ctx";
import { type RouteTable, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { compileRoutes } from "@keel/router/internal";
import { s } from "@keel/schema";
import { describe, expect, it, test } from "vitest";
import { createApp, topology } from "../src/index.ts";
import { secretSegments } from "../src/internal/secretSegments.ts";

const SEED = 1337;
const view = (): Node => document.createElement("main");
const marksOf = (table: RouteTable) => secretSegments(compileRoutes(table).located);
const tok = s.secret(s.string());

describe("a route led by a param", () => {
  it("marks the first segment of every path when the lead param is the secret", () => {
    const c1 = contract("app", { "app.t": { path: "/:token", params: s.object({ token: tok }) } });
    const one = marksOf(manifest(c1, { "app.t": { component: view } }));
    expect(one("/about")).toBe("/[secret]");
    expect(one("/about/team")).toBe("/[secret]");
    const c2 = contract("app", {
      "app.t": { path: "/:lang/:token", params: s.object({ lang: s.string(), token: tok }) },
    });
    const two = marksOf(manifest(c2, { "app.t": { component: view } }));
    expect(two("/about")).toBe("/[secret]");
    expect(two("/en/A")).toBe("/[secret]");
  });

  it("cuts at the first segment when a lead param precedes the secret, the path read without the lead too", () => {
    const c = contract("app", { "app.t": { path: "/:p/:tok", params: s.object({ p: s.string(), tok }) } });
    const marks = marksOf(manifest(c, { "app.t": { component: view } }));
    expect(marks("/en/A")).toBe("/[secret]");
    expect(marks("/A")).toBe("/[secret]");
  });
});

describe("an encoded separator", () => {
  test("before the secret marks the segment that holds it", () => {
    const c = contract("app", { "app.r": { path: "/reset/:token", params: s.object({ token: tok }) } });
    const marks = marksOf(manifest(c, { "app.r": { component: view } }));
    for (const p of ["/reset%2FSECRETx", "/reset%2fSECRETx", "/RESET%2FSECRETx", "/reset%5CSECRETx"])
      expect(marks(p)).toBe("/[secret]");
  });
});

const who = contract("app", {
  "app.who": { path: "/u/:email", params: s.object({ email: s.string().pii("contact") }) },
});

describe("a personal-data route param", () => {
  test("is [pii] in the req path", async () => {
    const lines: string[] = [];
    const app = await createApp({
      topology: topology({ web: { modules: ["app"], adapter: "node" } }),
      routes: manifest(who, { "app.who": { component: view } }),
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

describe("a path no route lines up with", () => {
  test("is written as sent: the stated limits of the line-up rule", () => {
    const c = contract("app", {
      "app.r": { path: "/reset/:token", params: s.object({ token: tok }) },
      "app.cb": { path: "/callback", search: s.object({ code: s.string().optional() }) },
    });
    const marks = marksOf(manifest(c, { "app.r": { component: view }, "app.cb": { component: view } }));
    for (const p of [
      "/en/reset/SECRETx",
      "/reset;jsessionid=AB12/SECRETx",
      "/reset./SECRETx",
      "/reset%20/SECRETx",
      "/%2552ESET/SECRETx",
      "/r%D0%B5set/SECRETx",
      "/callback&code=SECRETx",
    ])
      expect(marks(p)).toBe(p);
  });
});
