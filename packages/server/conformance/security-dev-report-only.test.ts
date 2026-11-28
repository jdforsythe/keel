// Spec: k.security, clause "A dev document carries `Content-Security-Policy-Report-Only` with `'unsafe-inline'` in `style-src` and nowhere else; JSON and event-stream responses carry `default-src 'none'; frame-ancestors 'none'`."
// Seed: 1337.
// @vitest-environment happy-dom
import { manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import { topology } from "@keel/server";
import { describe, expect, test } from "vitest";
import { createAppLoose, liveLoader, readChunks, simCtx } from "./topology-fixtures.ts";

const Out = s.object({ n: s.int() });
const T = () => topology({ web: { modules: ["app"], adapter: "node" } });

const directivesOf = (policy: string): string[] =>
  policy
    .split(";")
    .map((d) => d.trim())
    .filter((d) => d !== "");

async function setup(mode: "dev" | "production") {
  const appContract = contract("app", {
    "app.live": { method: "GET", path: "/api/live", events: true, output: Out },
    "app.plain": { path: "/plain" },
  });
  const live = liveLoader(appContract, "app.live", async function* () {
    yield ok({ n: 1 });
  });
  const routes = manifest(appContract, {
    "app.live": { loader: live },
    "app.plain": { component: () => document.createElement("main") },
  });
  return createAppLoose({ topology: T(), routes, ctx: simCtx(), mode });
}

describe("k.security: dev report-only policy", () => {
  test("A dev document carries `Content-Security-Policy-Report-Only` and no enforcing `Content-Security-Policy`", async () => {
    const app = await setup("dev");
    for (const p of ["/plain"]) {
      const res = await app.fetch(new Request(`http://localhost${p}`));
      expect(res.status).toBe(200);
      expect(res.headers.get("content-security-policy-report-only")).not.toBeNull();
      expect(res.headers.get("content-security-policy")).toBeNull();
      expect(res.headers.get("reporting-endpoints")).toBe('keel-csp="/__keel/csp"');
    }
  });

  test("a dev document has `'unsafe-inline'` in `style-src` and nowhere else", async () => {
    const app = await setup("dev");
    const res = await app.fetch(new Request("http://localhost/plain"));
    const ds = directivesOf(res.headers.get("content-security-policy-report-only") ?? "");
    const withInline = ds.filter((d) => d.includes("'unsafe-inline'"));
    expect(withInline).toHaveLength(1);
    expect(withInline[0]?.startsWith("style-src ")).toBe(true);
  });

  test("a production document has `'unsafe-inline'` nowhere", async () => {
    const app = await setup("production");
    const res = await app.fetch(new Request("http://localhost/plain"));
    expect(res.headers.get("content-security-policy") ?? "").not.toContain("'unsafe-inline'");
  });

  // ASSUMPTION: the spec says "Other responses carry `default-src 'none'; frame-ancestors 'none'` " without naming the header
  // in dev; the enforcing header is expected, report-only is accepted.
  test("JSON and event-stream responses carry `default-src 'none'; frame-ancestors 'none'`", async () => {
    for (const mode of ["dev", "production"] as const) {
      const app = await setup(mode);
      const json = await app.fetch(
        new Request("http://localhost/api/live", { headers: { accept: "application/json" } }),
      );
      const sse = await app.fetch(
        new Request("http://localhost/api/live", { headers: { accept: "text/event-stream" } }),
      );
      await readChunks(sse, 1);
      for (const res of [json, sse]) {
        const policy =
          res.headers.get("content-security-policy") ?? res.headers.get("content-security-policy-report-only") ?? "";
        expect(directivesOf(policy)).toEqual(["default-src 'none'", "frame-ancestors 'none'"]);
      }
    }
  });
});
