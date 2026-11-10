// @vitest-environment happy-dom
// Spec: k.prefix, clause "`/items/7` matches `x.show` with `p` `en-US` and `/de-DE/items/7` with `de-DE`; `/fr-FR/items/7` is 404; without `pathDefault`, `/items/7` is 404 and `/en-US/items/7` matches." (rfc:0079) Seed 1337.
// The HTTP half (status 404, params in the served component); the router half is packages/router/conformance/prefix-parse.test.ts.
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SEED, appFor, get, plainLocaleRoutes } from "./head-fixtures.ts";

const ids = fc.stringMatching(/^[a-z0-9]{1,8}$/);

describe("k.prefix parse (server)", () => {
  test.skip("/items/7 is served with p en-US and /de-DE/items/7 with de-DE", async () => {
    const app = await appFor("web");
    await fc.assert(
      fc.asyncProperty(ids, async (id) => {
        const a = await get(app, `/items/${id}`);
        expect(a.status).toBe(200);
        expect(await a.text()).toContain(`en-US:${id}`);
        const b = await get(app, `/de-DE/items/${id}`);
        expect(b.status).toBe(200);
        expect(await b.text()).toContain(`de-DE:${id}`);
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  test.skip("/fr-FR/items/7 is 404", async () => {
    const app = await appFor("web");
    expect((await get(app, "/fr-FR/items/7")).status).toBe(404);
  });

  test.skip("without pathDefault, /items/7 is 404 and /en-US/items/7 matches", async () => {
    const app = await appFor("web", plainLocaleRoutes);
    expect((await get(app, "/items/7")).status).toBe(404);
    const res = await get(app, "/en-US/items/7");
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("en-US:7");
  });
});
