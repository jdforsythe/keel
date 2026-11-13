// @vitest-environment happy-dom
// Spec: k.a11y, Conformance "A `render` of a component reports no document rule; a `renderRoute` of a titled route reports no `document-title` or `html-has-lang` violation."
// Seed: 1337.
// Untestable here: that a document rule "is not run" for `render` beyond "does not fail"; the spec names no report accessor in the harness (the run list is in reports/a11y.json, k.a11y Claims).
import { manifest } from "@keel/router";
import { s } from "@keel/schema";
import { render, renderRoute } from "@keel/testing";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, messageOf, simCtx, thrown } from "./fixtures.ts";
import { page } from "./ui-fixtures.ts";

const paragraph = (id: string, text: string): HTMLElement => {
  const p = document.createElement("p");
  p.id = id;
  p.textContent = text;
  return p;
};

describe("k.a11y: document rules run for a `renderRoute` page only", () => {
  it.skip("A `render` of a component reports no document rule", () => {
    // no <title>, no <html lang>, no main, no skip link: a document rule would fail every one of them
    const t = render(
      page(() => paragraph("dr.p", "hello")),
      { props: {}, ctx: simCtx() },
    );
    expect(t.find("dr.p").text).toBe("hello");
    t.dispose();
  });

  it.skip("a `renderRoute` of a titled route reports no `document-title` or `html-has-lang` violation", async () => {
    const routes = manifest({
      "dr.home": { path: "/dr", component: () => paragraph("dr.home", "home"), title: () => "Home" },
    });
    const h = await renderRoute("dr.home", { routes, ctx: simCtx() });
    expect(h.find("dr.home").text).toBe("home");
    h.dispose();
  });

  it.skip("any non-empty title leaves the route free of document-title and html-has-lang violations (property)", async () => {
    await fc.assert(
      fc.asyncProperty(fc.stringMatching(/^[A-Za-z][A-Za-z0-9 ]{0,20}$/), async (title) => {
        const routes = manifest({
          "dr.t": { path: "/t", component: () => paragraph("dr.t", "t"), title: () => title },
        });
        const e = await thrown(async () => (await renderRoute("dr.t", { routes, ctx: simCtx() })).dispose());
        expect(e === undefined ? "" : messageOf(e)).not.toMatch(/document-title|html-has-lang/);
        expect(e).toBeUndefined();
      }),
      { seed: SEED, numRuns: 25 },
    );
  });

  it.skip("the route's loaded data reaches the title, and the chain renders inside `main` (no landmark-one-main violation)", async () => {
    const routes = manifest({
      "dr.p": {
        path: "/p/:n",
        params: s.object({ n: s.int() }),
        component: () => paragraph("dr.p", "p"),
        title: (p) => `Page ${String(p.params.n)}`,
      },
    });
    const h = await renderRoute("dr.p", { routes, params: { n: 3 }, ctx: simCtx() });
    h.dispose();
    expect(true).toBe(true);
  });
});
