// @vitest-environment happy-dom
// Spec: k.prefix, clause "A GET of `/en-US/items/7?q=1` answers 308 with `Location: /items/7?q=1`; a client navigation to it ends at `/items/7` with `p` `en-US` and adds one history entry." (rfc:0079) Seed 1337.
// The HTTP half; the client half is packages/router/conformance/prefix-canonical-308.test.ts.
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SEED, appFor, get } from "./head-fixtures.ts";

describe("k.prefix canonical URL (server)", () => {
  test("a GET of /en-US/items/7?q=1 answers 308 with Location: /items/7?q=1", async () => {
    const app = await appFor("web");
    const res = await get(app, "/en-US/items/7?q=1");
    expect(res.status).toBe(308);
    expect(res.headers.get("location")).toBe("/items/7?q=1");
  });

  test("for any id and search, /en-US/... answers 308 to the path without the segment, search kept; /de-DE/... does not redirect", async () => {
    const app = await appFor("web");
    await fc.assert(
      fc.asyncProperty(
        fc.stringMatching(/^[a-z0-9]{1,8}$/),
        fc.stringMatching(/^[a-z]{1,4}=[a-z0-9]{1,4}$/),
        async (id, q) => {
          const r = await get(app, `/en-US/items/${id}?${q}`);
          expect(r.status).toBe(308);
          expect(r.headers.get("location")).toBe(`/items/${id}?${q}`);
          expect((await get(app, `/de-DE/items/${id}?${q}`)).status).toBe(200);
        },
      ),
      { seed: SEED, numRuns: 20 },
    );
  });
});
