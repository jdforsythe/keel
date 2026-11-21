// @vitest-environment happy-dom
// Spec: k.component, clause "A plain `.ts` module calling `If` and `Boundary` imported from `@keel/runtime-dom`, or naming `If` only as a parameter or destructuring default, compiles with that import kept and renders the chosen branch; a `.tsx` module using them only as tags compiles with the import removed."
// Seed 1337 (no random inputs: the spaces are two booleans, covered exhaustively).
import { createCtx } from "@keel/ctx";
import { compile } from "@keel/compiler";
import { evaluate } from "@keel/compiler/testing";
import { mount } from "@keel/runtime-dom";
import { expect, test } from "vitest";
import { isMountable } from "./support.ts";

const simCtx = createCtx({ mode: "sim", seed: 1337 });

const importsIntrinsic = (code: string, name: string): boolean =>
  new RegExp(`import\\s*\\{[^}]*\\b${name}\\b[^}]*\\}\\s*from\\s*["']@keel/runtime-dom["']`).test(code);

function build(path: string, source: string): string {
  const r = compile([{ path, source }]);
  expect(r.diagnostics).toEqual([]);
  const first = r.outputs[0];
  if (first === undefined) throw new Error("no output");
  return first.code;
}

const plainTs = `import { If, Boundary } from "@keel/runtime-dom"
export default function Pick(props: { on: boolean }) {
  return Boundary({
    children: () => If({ when: props.on, children: () => document.createTextNode("yes"), fallback: () => document.createTextNode("no") }),
    fallback: () => document.createTextNode("err"),
  })
}
`;

test("a plain .ts module calling If and Boundary keeps the @keel/runtime-dom import", () => {
  const code = build("Pick.ts", plainTs);
  expect(importsIntrinsic(code, "If")).toBe(true);
  expect(importsIntrinsic(code, "Boundary")).toBe(true);
});

test("a plain .ts module calling If and Boundary renders the chosen branch", () => {
  const c = evaluate(build("Pick.ts", plainTs));
  if (!isMountable(c)) throw new Error("default export is not a component");
  for (const on of [true, false]) {
    const el = document.createElement("div");
    mount(() => c({ on }, simCtx), el, { ctx: simCtx });
    expect(el.textContent).toBe(on ? "yes" : "no");
  }
});

test("a .tsx module using If only as a tag compiles with the import removed", () => {
  const code = build(
    "Tag.tsx",
    `import { If } from "@keel/runtime-dom"
export default function Tag(props: { x: boolean }) { return <div><If when={props.x}><b>y</b></If></div> }
`,
  );
  expect(importsIntrinsic(code, "If")).toBe(false);
});

test("a .tsx module using If as a tag and passing it as a value keeps the import", () => {
  const code = build(
    "Both.tsx",
    `import { If } from "@keel/runtime-dom"
export const alias = If
export default function Both(props: { x: boolean }) { return <div><If when={props.x}><b>y</b></If></div> }
`,
  );
  expect(importsIntrinsic(code, "If")).toBe(true);
});

const branches = `{ when: props.on, children: () => document.createTextNode("yes"), fallback: () => document.createTextNode("no") }`;

const defaultForms: ReadonlyArray<readonly [string, string]> = [
  [
    "a destructured parameter default",
    `import { If } from "@keel/runtime-dom"
function choose({ pick = If }: { pick?: typeof If } = {}) { return pick }
export default function Pick(props: { on: boolean }) { return choose()(${branches}) }
`,
  ],
  [
    "a destructuring default in a variable declaration",
    `import { If } from "@keel/runtime-dom"
export default function Pick(props: { on: boolean }) {
  const opts: { pick?: typeof If } = {}
  const { pick = If } = opts
  return pick(${branches})
}
`,
  ],
  [
    "a plain parameter default",
    `import { If } from "@keel/runtime-dom"
function f(p = If) { return p }
export default function Pick(props: { on: boolean }) { return f()(${branches}) }
`,
  ],
];

for (const [label, source] of defaultForms) {
  test(`a plain .ts module naming If only as ${label} compiles with no diagnostics and keeps the import`, () => {
    const code = build("Dflt.ts", source);
    expect(importsIntrinsic(code, "If")).toBe(true);
  });

  test(`a plain .ts module naming If only as ${label} renders the chosen branch`, () => {
    const c = evaluate(build("Dflt.ts", source));
    if (!isMountable(c)) throw new Error("default export is not a component");
    for (const on of [true, false]) {
      const el = document.createElement("div");
      mount(() => c({ on }, simCtx), el, { ctx: simCtx });
      expect(el.textContent).toBe(on ? "yes" : "no");
    }
  });
}
