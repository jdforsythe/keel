// Spec: k.security, Conformance "A `csp-report` POST answers 204 and logs one `csp` record whose `blocked` is the blocked URL's origin and `route` the document's route id; no record holds the document's path or query."
// Seed: 1337.
// @vitest-environment happy-dom
import { createCtx } from "@keel/ctx";
import { manifest } from "@keel/router";
import { createApp, topology } from "@keel/server";
import fc from "fast-check";
import { describe, expect, test } from "vitest";

const ID = "app.item";

async function setup() {
  const lines: string[] = [];
  const routes = manifest({
    [ID]: { path: "/items/:slug", component: () => document.createElement("main") },
  });
  const app = await createApp({
    topology: topology({ web: { modules: ["app"], adapter: "node" } }),
    routes,
    ctx: createCtx({ mode: "sim", seed: 1337 }),
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
  return { app, lines, csp };
}

// ASSUMPTION: the browser's own report shapes. The spec names the media types, not the bodies.
const legacy = (documentUri: string, blockedUri: string): string =>
  JSON.stringify({
    "csp-report": { "document-uri": documentUri, "violated-directive": "img-src", "blocked-uri": blockedUri },
  });
const modern = (documentUri: string, blockedUrl: string): string =>
  JSON.stringify([
    {
      type: "csp-violation",
      url: documentUri,
      body: { documentURL: documentUri, effectiveDirective: "img-src", blockedURL: blockedUrl },
    },
  ]);

const post = (app: { fetch(r: Request): Promise<Response> }, type: string, body: string): Promise<Response> =>
  app.fetch(new Request("http://localhost/__keel/csp", { method: "POST", body, headers: { "content-type": type } }));

const word = fc.stringMatching(/^[a-z]{6,12}$/);

describe("k.security: report endpoint log record", () => {
  test.skip("A `csp-report` POST answers 204 and logs one `csp` record whose `blocked` is the blocked URL's origin and `route` the document's route id", async () => {
    await fc.assert(
      fc.asyncProperty(word, word, async (slug, host) => {
        const { app, csp } = await setup();
        const res = await post(
          app,
          "application/csp-report",
          legacy(`http://localhost/items/${slug}`, `https://${host}.example/a/b.png?x=1`),
        );
        expect(res.status).toBe(204);
        const records = csp();
        expect(records).toHaveLength(1);
        expect(records[0]?.["kind"]).toBe("csp");
        expect(typeof records[0]?.["directive"]).toBe("string");
        expect(records[0]?.["blocked"]).toBe(`https://${host}.example`);
        expect(records[0]?.["route"]).toBe(ID);
      }),
      { seed: 1337, numRuns: 20 },
    );
  });

  test.skip("an `application/reports+json` POST answers 204 and logs the same record", async () => {
    const { app, csp } = await setup();
    const res = await post(
      app,
      "application/reports+json",
      modern("http://localhost/items/abc", "https://cdn.example/x.js"),
    );
    expect(res.status).toBe(204);
    expect(csp().map((r) => [r["blocked"], r["route"]])).toEqual([["https://cdn.example", ID]]);
  });

  test.skip("the `route` of a document no route matches is `-`", async () => {
    const { app, csp } = await setup();
    await post(app, "application/csp-report", legacy("http://localhost/nowhere", "https://cdn.example/x.png"));
    expect(csp().map((r) => r["route"])).toEqual(["-"]);
  });

  test.skip("`blocked` is `inline`, `eval` or `trusted-types` for those violations", async () => {
    const { app, csp } = await setup();
    for (const blocked of ["inline", "eval", "trusted-types"]) {
      await post(app, "application/csp-report", legacy("http://localhost/items/a", blocked));
    }
    expect(csp().map((r) => r["blocked"])).toEqual(["inline", "eval", "trusted-types"]);
  });

  test.skip("no record holds the document's path or query", async () => {
    await fc.assert(
      fc.asyncProperty(word, word, async (slug, q) => {
        const { app, lines } = await setup();
        const secret = `${q}${slug}`;
        const res = await post(
          app,
          "application/csp-report",
          legacy(`http://localhost/items/${slug}?token=${secret}`, "https://cdn.example/a.png"),
        );
        expect(res.status).toBe(204);
        const csp = lines.filter((l) => l.includes('"csp"'));
        expect(csp.length).toBeGreaterThan(0);
        for (const l of csp) {
          expect(l).not.toContain(slug);
          expect(l).not.toContain(secret);
          expect(l).not.toContain("token");
        }
      }),
      { seed: 1337, numRuns: 20 },
    );
  });

  test.skip("the endpoint takes the report without the write proof (no Origin header, no caller cookie)", async () => {
    const { app } = await setup();
    const res = await post(
      app,
      "application/csp-report",
      legacy("http://localhost/items/a", "https://cdn.example/a.png"),
    );
    expect(res.status).toBe(204);
    expect(res.headers.get("set-cookie")).toBeNull();
  });
});
