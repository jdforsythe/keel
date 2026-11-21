// @vitest-environment happy-dom
// k.server: a redirect's `location` is always a same-origin path. An action returning `ok(href)` for generated
// params and search answers 303 to a path with exactly one leading `/`, or an error with no `location`; the red
// team's `ok(ap.href('ap.open', { a: '', b: 'evil.example' }))` no longer answers `location: //evil.example`.
import { createCtx } from "@keel/ctx";
import { action, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { createApp, topology } from "../src/index.ts";
import { redirectResponse } from "../src/internal/redirectResponse.ts";

const BASE = "https://app.example";
const ap = contract("ap", {
  "ap.open": {
    path: "/:a/:b",
    params: s.object({ a: s.string(), b: s.string() }),
    search: s.object({ q: s.string().optional() }),
  },
});
let next: { a: string; b: string; q?: string } = { a: "x", b: "y" };
const act = action(ap, "ap.open", { input: s.object({}) }, () =>
  ok(ap.href("ap.open", { a: next.a, b: next.b }, next.q === undefined ? {} : { q: next.q })),
);
const routes = manifest(ap, { "ap.open": { component: () => document.createElement("p"), POST: act } });
const app = await createApp({
  topology: topology({ web: { modules: ["ap"], adapter: "node" } }),
  routes,
  ctx: createCtx({ mode: "sim", seed: 1337 }),
  mode: "production",
});
const post = (): Promise<Response> => app.fetch(new Request(`${BASE}/p/q`, { method: "POST", body: new FormData() }));
const sameOrigin = (loc: string): boolean =>
  new URL(loc, BASE).origin === BASE && loc.startsWith("/") && !loc.startsWith("//");

describe("a redirect stays on the origin", () => {
  it("the red team's empty param and backslash cases answer no off-origin location", async () => {
    for (const p of [
      { a: "", b: "evil.example" },
      { a: "", b: "\\evil.example" },
    ]) {
      next = p;
      const res = await post();
      expect(res.headers.get("location")).toBeNull();
      expect(res.status).toBe(500);
    }
  });

  it("for generated params and search, a location is a same-origin path-absolute URL", async () => {
    const piece = fc.oneof(fc.string(), fc.constantFrom("", "/", "//", "\\", "evil.example", "..", "\t", "@x"));
    await fc.assert(
      fc.asyncProperty(piece, piece, fc.option(piece, { nil: undefined }), async (a, b, q) => {
        next = q === undefined ? { a, b } : { a, b, q };
        const res = await post();
        const loc = res.headers.get("location");
        if (loc === null) expect(res.status).toBeGreaterThanOrEqual(400);
        else {
          expect(res.status).toBe(303);
          expect(sameOrigin(loc)).toBe(true);
        }
      }),
      { seed: 1337, numRuns: 150 },
    );
  });

  it("redirectResponse refuses what isHref refuses: an error and no location", () => {
    for (const bad of ["//evil.example", "/\\evil.example", "https://evil.example/", "/a\nb"]) {
      const res = redirectResponse(303, bad);
      expect([res.status, res.headers.get("location")]).toEqual([500, null]);
    }
    expect(redirectResponse(303, "/ok").headers.get("location")).toBe("/ok");
  });
});
