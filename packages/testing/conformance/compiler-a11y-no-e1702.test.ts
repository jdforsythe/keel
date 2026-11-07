// @vitest-environment happy-dom
// Seed 1337
// Spec: k.compiler, clause "<img alt=\"\">, an unnamed <section>, <td> and <li> with text render with no E1702."
// Non-vacuity: the same renders with a disagreeing a11y.json throw E1702, so "no E1702" is a real check.
import { compile } from "@keel/compiler";
import type { A11yEntry } from "@keel/compiler";
import { evaluate } from "@keel/compiler/testing";
import type { Slots } from "@keel/runtime-dom";
import { s } from "@keel/schema";
import { render } from "@keel/testing";
import type { TestComponent } from "@keel/testing";
import fc from "fast-check";
import { expect, test } from "vitest";
import { SEED, codeOf, simCtx, thrown } from "./fixtures.ts";

type A11yJson = Record<string, A11yEntry>;

function build(jsx: string): { component: TestComponent<Record<string, never>>; a11y: A11yJson } {
  const r = compile([{ path: "A.tsx", source: `export default function A() { return <div>${jsx}</div> }` }]);
  expect(r.diagnostics).toEqual([]);
  const out = r.outputs[0];
  if (out === undefined) throw new Error("fixture: no compiler output");
  const fn = evaluate(out.code);
  if (typeof fn !== "function") throw new Error("fixture: default export is not a component");
  const component: TestComponent<Record<string, never>> = Object.assign(
    (p: Record<string, never>, slots?: Slots): Node => {
      const node: unknown = fn(p, slots);
      if (!(node instanceof Node)) throw new Error("fixture: component did not return a Node");
      return node;
    },
    { Props: s.object({}) },
  );
  return { component, a11y: r.artifacts["a11y.json"] };
}

const FIXTURES = {
  imgEmpty: `<img id="img0" alt="" src="x.png" />`,
  imgNamed: `<img id="img1" alt="Logo" src="l.png" />`,
  sectionUnnamed: `<section id="sec0"><p id="p0">content</p></section>`,
  sectionNamed: `<section id="sec1" aria-label="Named"><p id="p1">content</p></section>`,
  table: `<table id="tbl"><tbody id="tb"><tr id="tr0"><td id="td0">cell</td></tr></tbody></table>`,
  list: `<ul id="ul0"><li id="li0">item</li></ul>`,
} as const;

const ALL = Object.values(FIXTURES);
const ROLES = ["button", "link", "heading", "region", "generic", "presentation", "cell", "listitem", "img"] as const;
const NAMES = ["label", "alt", "text", "aria", "none"] as const;

const withEntry = (a11y: A11yJson, id: string, patch: Partial<A11yEntry>): A11yJson => {
  const entry = a11y[id];
  if (entry === undefined) throw new Error(`fixture: no a11y entry ${id}`);
  return { ...a11y, [id]: { ...entry, ...patch } };
};

const renderWith = (jsx: string, artifact: (a: A11yJson) => A11yJson): unknown => {
  const { component, a11y } = build(jsx);
  try {
    const t = render(component, { props: {}, ctx: simCtx(), artifacts: { "a11y.json": artifact(a11y) } });
    t.dispose();
    return undefined;
  } catch (e) {
    return e ?? new Error("threw a falsy value");
  }
};

test('<img alt="">, an unnamed <section>, <td> and <li> with text render with no E1702', async () => {
  for (const jsx of ALL) {
    const { component, a11y } = build(jsx);
    const err = await thrown(() => {
      const t = render(component, { props: {}, ctx: simCtx(), artifacts: { "a11y.json": a11y } });
      t.dispose();
    });
    expect(err).toBeUndefined();
  }
});

test('a11y.json: <img alt=""> is presentation', () => {
  expect(build(FIXTURES.imgEmpty).a11y.img0).toMatchObject({ role: "presentation", name: "none" });
});

test("a11y.json: <img alt=Logo> is img named from alt", () => {
  expect(build(FIXTURES.imgNamed).a11y.img1).toMatchObject({ role: "img", name: "alt" });
});

test("a11y.json: unnamed <section> is generic", () => {
  expect(build(FIXTURES.sectionUnnamed).a11y.sec0).toMatchObject({ role: "generic" });
});

test('a11y.json: <section aria-label="Named"> is region', () => {
  expect(build(FIXTURES.sectionNamed).a11y.sec1).toMatchObject({ role: "region", name: "aria" });
});

test("a11y.json: <td> is cell with name source text", () => {
  expect(build(FIXTURES.table).a11y.td0).toMatchObject({ role: "cell", name: "text" });
});

test("a11y.json: <li> is listitem with no text name source", () => {
  const e = build(FIXTURES.list).a11y.li0;
  expect(e).toMatchObject({ role: "listitem" });
  expect(e?.name).not.toBe("text");
});

test("a11y.json with one entry's role changed makes render throw E1702 naming that element id", async () => {
  // Seed 1337
  await fc.assert(
    fc.asyncProperty(fc.constantFrom(...ALL), fc.nat(), fc.constantFrom(...ROLES), async (jsx, pick, wrong) => {
      const { a11y } = build(jsx);
      const ids = Object.entries(a11y)
        .filter(([, e]) => e.role !== null && e.role !== wrong)
        .map(([id]) => id);
      fc.pre(ids.length > 0);
      const id = ids[pick % ids.length];
      if (id === undefined) throw new Error("fixture: no id");
      const err = renderWith(jsx, (a) => withEntry(a, id, { role: wrong }));
      expect(codeOf(err)).toBe("E1702");
      expect(String(err instanceof Error ? err.message : err)).toContain(id);
    }),
    { seed: SEED, numRuns: 100 },
  );
});

test("a11y.json with one entry's name source changed makes render throw E1702 naming that element id", async () => {
  // Seed 1337
  await fc.assert(
    fc.asyncProperty(fc.constantFrom(...ALL), fc.nat(), fc.constantFrom(...NAMES), async (jsx, pick, wrong) => {
      const { a11y } = build(jsx);
      const ids = Object.entries(a11y)
        .filter(([, e]) => e.role !== null && e.name !== wrong)
        .map(([id]) => id);
      fc.pre(ids.length > 0);
      const id = ids[pick % ids.length];
      if (id === undefined) throw new Error("fixture: no id");
      const err = renderWith(jsx, (a) => withEntry(a, id, { name: wrong }));
      expect(codeOf(err)).toBe("E1702");
      expect(String(err instanceof Error ? err.message : err)).toContain(id);
    }),
    { seed: SEED, numRuns: 100 },
  );
});
