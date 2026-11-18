// @vitest-environment happy-dom
// Spec: k.testing, Harness "`resumeDocument(html, { routes: () => import(path) })` resumes in a module graph of its own: each module the import reaches, `@keel/store` too, evaluated anew."
// Spec: k.testing, Conformance "`resumeDocument` with `routes` as an import: a module store written before the request is initial in `state()`; a `fire` leaves the test's instance unchanged."
// Property seed: 1337 (fc.assert seed below). The island document is written by hand in the shape k.runtime gives a server document
// (`data-k-island="<route id>"`, one `#k-state`), rendered here with this test's own instance of the routes module and its store.
import { mount } from "@keel/runtime-dom";
import { tx } from "@keel/store";
import { resumeDocument } from "@keel/testing";
import fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";
import { SEED, simCtx } from "./fixtures.ts";
import { Island, count, inc, routes } from "./resume-document-graph-routes.ts";

const PRISTINE = count.snapshot();

afterEach(() => {
  count.restore(PRISTINE);
});

/** The document a server would send after this test wrote the module store `times` times in its own instance. */
function documentAfter(times: number): string {
  for (let i = 0; i < times; i++) void tx(inc, {});
  const scratch = document.createElement("div");
  const dispose = mount((p, _slots, ctx) => Island(Object.assign({}, p, { ctx })), scratch, { ctx: simCtx() });
  const root = scratch.firstElementChild;
  if (root === null) throw new Error("fixture: no island root");
  root.setAttribute("data-k-island", "gd.page");
  const html = root.outerHTML;
  dispose();
  return `<!doctype html><html><head><title>t</title></head><body>${html}<script type="application/json" id="k-state">${JSON.stringify({ stores: {}, islands: { "gd.page": {} } })}</script></body></html>`;
}

const client = (html: string) => resumeDocument(html, { routes: () => import("./resume-document-graph-routes.ts") });

describe("k.testing: resumeDocument with routes as an import resumes in a module graph of its own", () => {
  it("a module store written before the request is initial in state()", async () => {
    const html = documentAfter(5);
    expect(count.get("n")).toBe(5);
    const t = await client(html);
    expect(t.state()["gd.count"]).toEqual({ n: 0 });
    t.dispose();
  });

  it("a fire leaves the test's instance unchanged: the island's write lands in the graph's own store", async () => {
    const html = documentAfter(5);
    const t = await client(html);
    await t.fire("gd.go", { type: "click" });
    expect(t.state()["gd.count"]).toEqual({ n: 1 });
    expect(count.get("n")).toBe(5);
    t.dispose();
    expect(count.get("n")).toBe(5);
  });

  it("property: for any number of writes before the request and any number of fires, the graph's store counts the fires and the test's counts the writes", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 0, max: 6 }), fc.integer({ min: 0, max: 4 }), async (writes, fires) => {
        count.restore(PRISTINE);
        const t = await client(documentAfter(writes));
        expect(t.state()["gd.count"]).toEqual({ n: 0 });
        for (let i = 0; i < fires; i++) await t.fire("gd.go", { type: "click" });
        expect(t.state()["gd.count"]).toEqual({ n: fires });
        expect(count.get("n")).toBe(writes);
        t.dispose();
      }),
      { seed: SEED, numRuns: 15 },
    );
  });

  it("the module the import reaches is evaluated anew: the graph's store is not the test's, though both carry the id gd.count", async () => {
    const t = await client(documentAfter(2));
    expect(Object.keys(t.state())).toContain("gd.count");
    expect(t.state()["gd.count"]).not.toEqual(count.snapshot().state);
    t.dispose();
  });

  it("passing the manifest object stays allowed: the island shares the test's module instance", async () => {
    const t = await resumeDocument(documentAfter(2), { routes });
    expect(t.state()["gd.count"]).toEqual({ n: 2 });
    await t.fire("gd.go", { type: "click" });
    expect(count.get("n")).toBe(3);
    t.dispose();
  });
});
