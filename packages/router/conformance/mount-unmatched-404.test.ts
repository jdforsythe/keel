// @vitest-environment happy-dom
// k.mount, Navigation "An initial load or a history pop of an unmatched path still renders the 404."
// Seed 1337 (fc.assert below). A router over the fixture table, with an in-memory history; the 404 is the `keel.notFound`
// default alert of k.head, `<h1>Not found</h1>`, and no page of the table renders.
import fc from "fast-check";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SEED, resetObservations, settle, start } from "./fixtures.ts";
import type { Started } from "./fixtures.ts";

const shown = (app: Started): string => app.host.querySelector("h1")?.textContent ?? "";
const pages = (app: Started): number => app.host.querySelectorAll("[data-page]").length;

let app: Started | null = null;
afterEach(() => {
  app?.stop();
  app = null;
});

describe("k.mount: an unmatched path still renders the 404 on an initial load and a history pop", () => {
  beforeEach(resetObservations);

  it("an initial load of a path under the mount renders the 404 and none of the router's pages", async () => {
    app = await start("/api/auth/sign-in/email", { render: true });
    expect(shown(app)).toBe("Not found");
    expect(pages(app)).toBe(0);
  });

  it("a history pop to an unmatched path, for generated mount subpaths, renders the 404 and not the page it left", async () => {
    app = await start("/orders", { render: true });
    expect(pages(app)).toBe(1);
    const current = app;
    await fc.assert(
      fc.asyncProperty(fc.stringMatching(/^[a-z]{1,8}$/), async (seg) => {
        current.history.external("/orders");
        await settle();
        expect(pages(current)).toBe(1);
        current.history.external(`/api/auth/${seg}`);
        await settle();
        expect(shown(current)).toBe("Not found");
        expect(pages(current)).toBe(0);
        current.history.back();
        await settle();
        expect(pages(current)).toBe(1);
      }),
      { seed: SEED, numRuns: 20 },
    );
  });
});
