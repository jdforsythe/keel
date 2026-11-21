// @vitest-environment happy-dom
// Spec: RFC 0162 Conformance diff: "`<Child />` in a component's JSX gives `Child` the parent's ctx, also when the parent declares one parameter, and in an island resumed by `resume`."
// Spec: RFC 0162 Proposal 2: "The compiler lowers `<Child a={x} />` inside a component to `Child({ get a() { ... } }, ctx)`, where `ctx` is the enclosing component's second parameter, which `ctxParams` adds ... when the function has fewer than two." Seed 1337.
// Components are compiled in memory and evaluated; the child is a hand-written function of the harness recording its second argument.
import { compile } from "@keel/compiler";
import { evaluate } from "@keel/compiler/testing";
import { createCtx } from "@keel/ctx";
import type { Ctx } from "@keel/ctx";
import { mount } from "@keel/runtime-dom";
import { resume } from "@keel/runtime-dom/ops";
import fc from "fast-check";
import { describe, expect, test } from "vitest";

const SEED = 1337;
type Seen = { props: unknown; ctx: unknown }[];

const CHILD = `import type { Ctx } from '@keel/ctx'
function Child(props: object, ctx: Ctx) {
  Reflect.get(globalThis, "__kSeen").push({ props, ctx })
  return <i />
}
`;

/** Compile `source` (a component file whose default export renders `<Child />`, `Child` being the recording component above), and return the evaluated default export. */
function build(name: string, source: string, seen: Seen) {
  const r = compile([{ path: `${name}.tsx`, source: `${CHILD}${source}` }]);
  expect(r.diagnostics).toEqual([]);
  const out = r.outputs[0];
  if (out === undefined) throw new Error("fixture: no compiler output");
  Reflect.set(globalThis, "__kSeen", seen);
  const parent = evaluate(out.code);
  if (typeof parent !== "function") throw new Error("fixture: default export is not a component");
  return (props: Readonly<Record<string, unknown>>, ctx: Ctx): Node => {
    const node: unknown = parent(props, ctx);
    if (!(node instanceof Node)) throw new Error("fixture: component did not return a Node");
    return node;
  };
}

const host = (): HTMLElement => {
  const el = document.createElement("div");
  document.body.append(el);
  return el;
};

describe("k.compiler: a JSX child gets the enclosing component's ctx", () => {
  test("`<Child />` gives `Child` the parent's ctx when the parent declares `(props, ctx: Ctx)`", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1_000_000 }), (seed) => {
        const seen: Seen = [];
        const parent = build(
          "WithCtx",
          "export default function P(props: {}, ctx: Ctx) { return <section><Child /></section> }\n",
          seen,
        );
        const ctx = createCtx({ mode: "sim", seed });
        const el = host();
        const dispose = mount(parent, el, { ctx });
        expect(seen).toHaveLength(1);
        expect(seen[0]?.ctx).toBe(ctx);
        dispose();
        el.remove();
      }),
      { seed: SEED, numRuns: 10 },
    );
  });

  test("`<Child />` gives `Child` the parent's ctx also when the parent declares one parameter or none", () => {
    for (const params of ["props: {}", ""]) {
      const seen: Seen = [];
      const parent = build(
        "OneParam",
        `export default function P(${params}) { return <section><Child /></section> }\n`,
        seen,
      );
      const ctx = createCtx({ mode: "sim", seed: SEED });
      const el = host();
      const dispose = mount(parent, el, { ctx });
      expect(seen, params).toHaveLength(1);
      expect(seen[0]?.ctx, params).toBe(ctx);
      dispose();
      el.remove();
    }
  });

  test("`<Child a={x} />` passes its props first and the ctx second", () => {
    const seen: Seen = [];
    const parent = build(
      "WithProps",
      "export default function P(props: { x: string }) { return <section><Child a={props.x} /></section> }\n",
      seen,
    );
    const ctx = createCtx({ mode: "sim", seed: SEED });
    const el = host();
    const dispose = mount((_p: Record<string, never>, c: Ctx) => parent({ x: "v" }, c), el, { ctx });
    const first = seen[0];
    expect(first?.ctx).toBe(ctx);
    expect(Reflect.get(Object(first?.props), "a")).toBe("v");
    dispose();
    el.remove();
  });

  test("the compiled output passes no `undefined` slots argument: a child call has the ctx as its second argument", () => {
    const r = compile([
      {
        path: "P.tsx",
        source:
          "import Child from './Child.tsx'\nexport default function P(props: {}, ctx: Ctx) { return <section><Child /></section> }\n",
      },
    ]);
    const code = r.outputs[0]?.code ?? "";
    expect(code).not.toMatch(/Child\([\s\S]*?,\s*undefined\s*,/);
    expect(code).toMatch(/Child\(\{[\s\S]*?\},\s*\w*ctx\)/i);
  });

  test("in an island resumed by `resume`, `<Child />` gets the ctx `resume` was given", () => {
    const seen: Seen = [];
    const parent = build(
      "Island",
      "export default function P(props: {}, ctx: Ctx) { return <section id='isl.root'><Child /></section> }\n",
      seen,
    );
    const ctx = createCtx({ mode: "sim", seed: SEED });
    document.body.innerHTML = `<section id="isl.root" data-k-island="Island"></section><script type="application/json" id="k-state">${JSON.stringify({ stores: {}, islands: { Island: {} } })}</script>`;
    resume(document.body, { Island: parent }, { ctx });
    expect(seen.length).toBeGreaterThanOrEqual(1);
    for (const s of seen) expect(s.ctx).toBe(ctx);
  });
});
