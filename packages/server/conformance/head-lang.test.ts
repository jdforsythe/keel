// @vitest-environment happy-dom
// Spec: k.head, clause "With a prefix param whose `pathDefault` is `en-US`, the document at `/de-DE/...` has `<html lang="de-DE">` and at the unprefixed URL `<html lang="en-US">`; a route with no prefix param has `lang="en"`." (rfc:0079) Seed 1337.
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SEED, appFor, get, parseDoc, plainLocaleRoutes } from "./head-fixtures.ts";

const ids = fc.stringMatching(/^[a-z0-9]{1,8}$/);

describe("k.head lang", () => {
  test('the document at /de-DE/... has <html lang="de-DE"> and at the unprefixed URL <html lang="en-US">', async () => {
    const app = await appFor("web");
    await fc.assert(
      fc.asyncProperty(ids, async (id) => {
        expect(parseDoc(await (await get(app, `/de-DE/items/${id}`)).text()).lang).toBe("de-DE");
        expect(parseDoc(await (await get(app, `/items/${id}`)).text()).lang).toBe("en-US");
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  test('a route with no prefix param has lang="en"', async () => {
    const app = await appFor("web");
    expect(parseDoc(await (await get(app, "/plain")).text()).lang).toBe("en");
  });

  test('a 404 has lang="en"', async () => {
    const app = await appFor("web");
    const res = await get(app, "/no/such/page/at/all");
    expect(res.status).toBe(404);
    expect(parseDoc(await res.text()).lang).toBe("en");
  });

  test('a prefix param without pathDefault leaves lang="en" on the document', async () => {
    const app = await appFor("web", plainLocaleRoutes);
    const res = await get(app, "/de-DE/items/7");
    expect(res.status).toBe(200);
    expect(parseDoc(await res.text()).lang).toBe("en");
  });
});
