// Spec: k.component, clause "`{a ? <b/> : <i/>}`, `{a && <b/>}`, `{[<b/>]}` and `{xs.map((x) => <li/>)}` as children are each one E1403 and render nothing; `<If when={a} fallback={() => <i/>}>` renders `<i>` while `a` is falsy."
// Spec: k.component, Control flow: "Elements in a JSX child expression are E1403 and bind nothing" (rfc:0061).
// @vitest-environment happy-dom
// Seed 1337 (fc.assert seed below). RFC 0061.
import { compile } from "@keel/compiler";
import { evaluate } from "@keel/compiler/testing";
import { If, mount } from "@keel/runtime-dom";
import fc from "fast-check";
import { expect, test } from "vitest";
import { type Mountable, SEED, isMountable, sigOf } from "./support.ts";

/** Compiles `jsx` as a component body over signals `a` (condition) and `xs` (list), keeping output despite diagnostics. */
function build(jsx: string, imports = ""): { B: Mountable; diagnostics: { code: string }[] } {
  const src = `
import { signal } from '@keel/reactive'
${imports}
const a = signal(true)
const xs = signal([1, 2, 3])
function B() {
  return ${jsx}
}
B.a = a
B.xs = xs
export default B
`;
  const r = compile([{ path: "B.tsx", source: src }]);
  const first = r.outputs[0];
  if (first === undefined) throw new Error("no output");
  const B = evaluate(first.code);
  if (!isMountable(B)) throw new Error("default export is not a component");
  return { B, diagnostics: r.diagnostics };
}

function html(B: Mountable, a: boolean, xs: number[]): string {
  sigOf(B, "a").set(a);
  sigOf(B, "xs").set(xs);
  const host = document.createElement("div");
  const dispose = mount(B, host);
  const out = host.innerHTML;
  dispose();
  return out;
}

const e1403 = (d: { code: string }[]) => d.filter((x) => x.code === "E1403");

function expectNothing(out: string): void {
  expect(out).not.toContain("[object");
  expect(out).not.toMatch(/<(b|i|li)[\s>/]/);
}

const FORMS: readonly [string, string][] = [
  ["{a ? <b/> : <i/>}", "<div>{a.get() ? <b/> : <i/>}</div>"],
  ["{a && <b/>}", "<div>{a.get() && <b/>}</div>"],
  ["{[<b/>]}", "<div>{[<b/>]}</div>"],
  ["{xs.map((x) => <li/>)}", "<ul>{xs.get().map((x) => <li/>)}</ul>"],
];

for (const [label, jsx] of FORMS) {
  test(`${label} as children is one E1403 and renders nothing`, () => {
    const { B, diagnostics } = build(jsx);
    expect(e1403(diagnostics)).toHaveLength(1);
    for (const a of [true, false]) {
      for (const xs of [[], [1], [1, 2, 3]]) expectNothing(html(B, a, xs));
    }
  });
}

test("`<If when={a} fallback={() => <i/>}>` renders `<i>` while `a` is falsy", () => {
  const { B, diagnostics } = build(
    "<div><If when={a.get()} fallback={() => <i/>}><b/></If></div>",
    "import { If } from '@keel/runtime-dom'",
  );
  expect(e1403(diagnostics)).toEqual([]);
  expect(typeof If).toBe("function");
  const falsy = html(B, false, []);
  expect(falsy).toContain("<i");
  expect(falsy).not.toContain("<b");
  const truthy = html(B, true, []);
  expect(truthy).toContain("<b");
  expect(truthy).not.toContain("<i");
});

test("a ternary of elements under any condition name and tag names is one E1403 and renders nothing (property)", () => {
  const ident = fc
    .stringMatching(/^[a-z][a-zA-Z0-9]{0,6}$/)
    .filter((s) => !["if", "do", "in", "of", "as", "is", "xs"].includes(s));
  const tag = fc.constantFrom("b", "i", "li", "em", "span", "p", "section");
  fc.assert(
    fc.property(ident, tag, tag, (name, t1, t2) => {
      const src = `
import { signal } from '@keel/reactive'
const ${name} = signal(true)
function B() {
  return <div>{${name}.get() ? <${t1}/> : <${t2}/>}</div>
}
B.a = ${name}
B.xs = signal([])
export default B
`;
      const r = compile([{ path: "B.tsx", source: src }]);
      expect(e1403(r.diagnostics)).toHaveLength(1);
      const first = r.outputs[0];
      if (first === undefined) throw new Error("no output");
      const B = evaluate(first.code);
      if (!isMountable(B)) throw new Error("not a component");
      for (const v of [true, false]) {
        sigOf(B, "a").set(v);
        const host = document.createElement("div");
        const dispose = mount(B, host);
        const out = host.innerHTML;
        dispose();
        expect(out).not.toContain("[object");
        expect(out).not.toMatch(new RegExp(`<(${t1}|${t2})[\\s>/]`));
      }
    }),
    { seed: SEED, numRuns: 50 },
  );
});
