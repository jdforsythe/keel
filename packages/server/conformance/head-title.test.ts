// @vitest-environment happy-dom
// Spec: k.head, clause "A node document for a route with `title` has `<title>` its return value, escaped; for a route without one, after a loader `err`, and for a 404, the deployable's name." (rfc:0079) Seed 1337.
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SEED, appFor, get, parseDoc, unescapeText } from "./head-fixtures.ts";

const names = fc.stringMatching(/^[a-z][a-z0-9-]{0,15}$/);

describe("k.head title", () => {
  test("a node document for a route with `title` has `<title>` its return value, escaped", async () => {
    await fc.assert(
      fc.asyncProperty(names, fc.stringMatching(/^[a-z0-9]{1,8}$/), async (name, id) => {
        const app = await appFor(name);
        const res = await get(app, `/de-DE/items/${id}`);
        expect(res.status).toBe(200);
        const raw = await res.text();
        const { title } = parseDoc(raw);
        expect(title).not.toContain("<");
        expect(unescapeText(title ?? "")).toBe(`Item ${id} <&> "q"`);
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  test("a node document for a route without a `title` has `<title>` the deployable's name", async () => {
    await fc.assert(
      fc.asyncProperty(names, async (name) => {
        const app = await appFor(name);
        expect(parseDoc(await (await get(app, "/de-DE/untitled")).text()).title).toBe(name);
        expect(parseDoc(await (await get(app, "/ok")).text()).title).toBe(name);
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  test("a node document after a loader `err` has `<title>` the deployable's name even when the route has a `title`", async () => {
    await fc.assert(
      fc.asyncProperty(names, async (name) => {
        const app = await appFor(name);
        const res = await get(app, "/de-DE/broken");
        expect(parseDoc(await res.text()).title).toBe(name);
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  test("a node document for a 404 has `<title>` the deployable's name", async () => {
    await fc.assert(
      fc.asyncProperty(names, async (name) => {
        const app = await appFor(name);
        const res = await get(app, "/no/such/page/at/all");
        expect(res.status).toBe(404);
        expect(parseDoc(await res.text()).title).toBe(name);
      }),
      { seed: SEED, numRuns: 20 },
    );
  });
});
