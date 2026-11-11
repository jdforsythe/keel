// @vitest-environment happy-dom
// Spec: k.topology, clause "With `origin` `https://a.example`, a POST with that `Origin` to another host passes the same-site check, and the caller cookie is `__Host-keel-caller`."
// Seed 1337 (fc.assert below).
import { action, manifest } from "@keel/router";
import { ok, s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { topology } from "@keel/server";
import { SEED, createAppLoose, pageManifest, simCtx, withHeaders } from "./topology-fixtures.ts";

describe("k.topology: origin", () => {
  test("With `origin` `https://a.example`, a POST with that `Origin` to another host passes the same-site check, and the caller cookie is `__Host-keel-caller`.", async () => {
    await fc.assert(
      fc.asyncProperty(fc.stringMatching(/^[a-z]{3,10}$/), async (host) => {
        let calls = 0;
        const act = action({ input: s.object({ note: s.string() }) }, () => {
          calls++;
          return Promise.resolve(ok(null));
        });
        const base = pageManifest("app", "/n", "N");
        const routes = manifest({ ...base.routes });
        routes.actions({ "app.show": { POST: act } });
        const app = await createAppLoose({
          topology: topology({ web: { modules: ["app"], adapter: "node" } }),
          routes,
          ctx: simCtx(),
          origin: "https://a.example",
          secret: "k".repeat(32),
        });
        const fd = new FormData();
        fd.set("note", "x");
        const req = withHeaders(new Request(`http://${host}.internal/n`, { method: "POST", body: fd }), {
          origin: "https://a.example",
        });
        const res = await app.fetch(req);
        expect(res.status).not.toBe(403);
        expect(calls).toBe(1);
        expect(res.headers.get("set-cookie") ?? "").toContain("__Host-keel-caller=");
        expect(res.headers.get("set-cookie") ?? "").toContain("Secure");
      }),
      { seed: SEED, numRuns: 10 },
    );
  });
});
