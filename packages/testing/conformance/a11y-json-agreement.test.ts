import type { Ctx } from "@keel/ctx";
// @vitest-environment happy-dom
// Seed 1337
// Spec: k.compiler, clause "`<img alt=\"\">`, an unnamed `<section>`, `<td>` and `<li>` with text render with no E1702."
import { compile } from "@keel/compiler";
import { evaluate } from "@keel/compiler/testing";
import { s } from "@keel/schema";
import { render } from "@keel/testing";
import type { TestComponent } from "@keel/testing";
import fc from "fast-check";
import { expect, test } from "vitest";

const NoProps = s.object({});

function build(jsx: string) {
  const r = compile([{ path: "A.tsx", source: `export default function A() { return <div>${jsx}</div> }` }]);
  expect(r.diagnostics).toEqual([]);
  const out = r.outputs[0];
  if (out === undefined) throw new Error("fixture: no compiler output");
  const fn = evaluate(out.code);
  if (typeof fn !== "function") throw new Error("fixture: default export is not a component");
  const component: TestComponent<Record<string, never>> = Object.assign(
    (p: Record<string, never>, ctx: Ctx): Node => {
      const node: unknown = fn(p, ctx);
      if (!(node instanceof Node)) throw new Error("fixture: component did not return a Node");
      return node;
    },
    { Props: NoProps },
  );
  return { component, a11y: r.artifacts["a11y.json"] };
}

const CASES = {
  d: `<img id="d" alt="" src="https://x.test/a.png" />`,
  s: `<section id="s"><p id="p">x</p></section>`,
  n: `<section id="n" aria-label="News"><p id="p">x</p></section>`,
  c: `<table><tbody><tr id="r"><td id="c">Cell</td></tr></tbody></table>`,
  l: `<ul><li id="l">Item</li></ul>`,
  b: `<button id="b">Go</button>`,
  a: `<a id="a" href="https://x.test">Home</a>`,
};

test('<img alt="">, an unnamed <section>, <td> and <li> with text render with no E1702', () => {
  fc.assert(
    fc.property(fc.constantFrom(...Object.values(CASES)), (jsx) => {
      const { component, a11y } = build(jsx);
      const t = render(component, { props: {}, artifacts: { "a11y.json": a11y } });
      t.dispose();
    }),
    { seed: 1337, numRuns: 14 },
  );
});

test('a11y.json: img with literal alt="" is presentation, unnamed', () => {
  expect(build(CASES.d).a11y.d).toMatchObject({ role: "presentation", name: "none" });
});

test("a11y.json: section without aria-label(ledby) is generic", () => {
  expect(build(CASES.s).a11y.s).toMatchObject({ role: "generic" });
});

test("a11y.json: section with aria-label is a region named from aria", () => {
  expect(build(CASES.n).a11y.n).toMatchObject({ role: "region", name: "aria" });
});

test("a11y.json: listitem takes no name from content", () => {
  expect(build(CASES.l).a11y.l).toMatchObject({ role: "listitem", name: "none" });
});

test("a11y.json: cell takes its name from text", () => {
  expect(build(CASES.c).a11y.c).toMatchObject({ role: "cell", name: "text" });
});
