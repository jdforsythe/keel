// @vitest-environment happy-dom
// Spec: k.testing Harness (`resumeDocument`) and Rules (E1720); k.runtime Islands and resume. Seed: 1337.
import { createCtx } from "@keel/ctx";
import { manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { mount } from "@keel/runtime-dom";
import { resumeDocument } from "@keel/testing";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { Editor, Fragile, notes } from "./support/components.ts";

const SEED = 1337;
const sim = () => createCtx({ mode: "sim", seed: SEED });

/** The server markup of one island: `view` rendered, its root marked `data-k-island="<id>"`. */
const islandHtml = (id: string, view: () => Node): string => {
  const scratch = document.createElement("div");
  const dispose = mount(view, scratch, { ctx: sim() });
  const root = scratch.firstElementChild;
  if (root === null) throw new Error("fixture: no island root");
  root.setAttribute("data-k-island", id);
  const html = root.outerHTML;
  dispose();
  return html;
};

const page = (body: string, state: unknown): string =>
  [
    `<!doctype html><html><head><title>t</title></head><body>${body}`,
    '<script type="module" src="/@keel/entry.ts"></script>',
    `<script type="application/json" id="k-state">${JSON.stringify(state)}</script></body></html>`,
  ].join("");

/** `Fragile` as a route component: its `Props` schema decodes the island state. */
const FragileRoute = Object.assign(
  (p: Readonly<Record<string, unknown>>): Node => Fragile({ n: typeof p.n === "number" ? p.n : 0 }),
  { Props: Fragile.Props },
);

const c = contract("rd", { "rd.ed": { path: "/ed" }, "rd.fr": { path: "/fr" } });
const routes = manifest(c, {
  "rd.ed": { component: Editor },
  "rd.fr": { component: FragileRoute },
});
const editor = () => islandHtml("rd.ed", () => Editor({}));
const snapshotWith = (text: string) => ({ ...notes.snapshot(), state: { text, focused: false, keys: [] } });

const rejection = async (p: Promise<unknown>): Promise<unknown> =>
  p.then(
    () => undefined,
    (e: unknown) => e,
  );

describe("resumeDocument", () => {
  it("restores the served stores, runs island handlers on the server nodes, and puts every store back on dispose", async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ maxLength: 12 }), fc.integer({ min: 0, max: 3 }), async (text, submits) => {
        const html = page(editor(), { stores: { "test.notes": snapshotWith(text) }, islands: { "rd.ed": {} } });
        const t = await resumeDocument(html, { routes, ctx: sim() });
        expect(t.state(notes).text).toBe(text);
        expect(t.find("ed.out").text).toBe(`${text}|0`.trim());
        for (let i = 0; i < submits; i++) await t.fire("ed.form", { type: "submit" });
        expect(t.find("ed.out").text).toBe(`${text}|${submits}`.trim());
        t.dispose();
        expect(notes.get("text")).toBe("");
        expect(document.body.childElementCount).toBe(0);
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  it("drops every script but #k-state and resolves for a document with no islands", async () => {
    const html = page('<main><h1 id="pg.title">Static</h1></main><script id="pg.inline">1</script>', {});
    const t = await resumeDocument(html, { routes, ctx: sim() });
    expect(t.find("pg.title").text).toBe("Static");
    expect(() => t.find("pg.inline")).toThrow(/^E1705 /);
    t.dispose();
  });

  it("E1720 names the first warning: an island whose route is not in routes", async () => {
    const html = page(
      islandHtml("gone", () => Editor({})),
      { stores: { "test.notes": snapshotWith("x") } },
    );
    const e = await rejection(resumeDocument(html, { routes, ctx: sim() }));
    expect(e).toMatchObject({ code: "E1720", see: "k.testing" });
    expect(e instanceof Error ? e.message : "").toMatch(
      /^E1720 the document did not resume: E1253 \[data-k-island="gone"\] has no compiled component/,
    );
    expect(document.body.childElementCount).toBe(0);
    expect(notes.get("text")).toBe("");
  });

  it("E1720: island state that fails the component's Props schema", async () => {
    const html = page(
      islandHtml("rd.fr", () => Fragile({ n: 1 })),
      { islands: { "rd.fr": { n: "one" } } },
    );
    const e = await rejection(resumeDocument(html, { routes, ctx: sim() }));
    expect(e instanceof Error ? e.message : "").toMatch(/^E1720 .*\[data-k-island="rd.fr"\] props do not decode/);
  });

  it("a document whose islands all resume raises no E1720", async () => {
    const html = page(
      islandHtml("rd.fr", () => Fragile({ n: 2 })),
      { islands: { "rd.fr": { n: 2 } } },
    );
    const t = await resumeDocument(html, { routes, ctx: sim() });
    expect(t.find("fragile").text).toBe("ok");
    t.dispose();
  });
});
