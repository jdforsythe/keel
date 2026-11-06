// @vitest-environment happy-dom
// D35-D37: Props/uses attached to the default export, Match always lowered with an explicit key, and the
// Vite plugin skipping test files and vitest.config.ts.
import fs from "node:fs";
import path from "node:path";
import { compile } from "@keel/compiler";
import { evaluate } from "@keel/compiler/testing";
import keel from "@keel/compiler/vite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const codeOf = (source: string, file = "modules/t/C.tsx"): string => {
  const r = compile([{ path: file, source }]);
  expect(r.diagnostics).toEqual([]);
  return r.outputs[0]?.code ?? "";
};

describe("Props and uses are attached to the default export (D35)", () => {
  it("emits Name.Props = Props and Name.uses = uses after the body", () => {
    const code = codeOf(`export const Props = { marker: 1 };
export const uses = [];
export default function C() { return <p>x</p>; }`);
    expect(code).toMatch(/\nC\.Props = Props;\nC\.uses = uses;\n$/);
    const C = evaluate(code);
    expect(typeof C === "function" ? Reflect.get(C, "Props") : undefined).toEqual({ marker: 1 });
    expect(typeof C === "function" ? Reflect.get(C, "uses") : undefined).toEqual([]);
  });

  it("handles `export default Name`, renamed exports and skips existing assignments or no Props", () => {
    expect(
      codeOf("const P = 1;\nexport { P as Props };\nfunction C() { return <p>x</p>; }\nexport default C;"),
    ).toContain("C.Props = P;");
    expect(
      codeOf("export const Props = 1;\nexport default function C() { return <p>x</p>; }\nC.Props = Props;"),
    ).not.toMatch(/C\.Props = Props;\n$/);
    expect(codeOf("export default function C() { return <p>x</p>; }")).not.toContain(".Props");
  });
});

describe("Match lowers with an explicit discriminant (D36)", () => {
  const src = (tags: string[], on = "st.get()"): string =>
    `const st = { get: () => ({}) };\nexport default function C() { return <section><Match on={${on}}>${tags
      .map((t) => `<Case tag="${t}"><i>${t}</i></Case>`)
      .join("")}</Match></section>; }`;
  const head = "import { Match, Case } from '@keel/runtime-dom';\n";

  it("passes `state` when every tag is loading|error|ready, else `tag`", () => {
    expect(codeOf(head + src(["loading", "ready"]))).toMatch(/\.match\([^\n]*, "state", \{/);
    expect(codeOf(head + src(["loading", "error", "ready"]))).toMatch(/\.match\([^\n]*, "state", \{/);
    expect(codeOf(head + src(["a", "b"]))).toMatch(/\.match\([^\n]*, "tag", \{/);
    expect(codeOf(head + src(["loading", "b"]))).toMatch(/\.match\([^\n]*, "tag", \{/);
  });
});

describe("the Vite plugin skips test code (D37)", () => {
  let root = "";
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(import.meta.dirname, ".tmp-skip-"));
  });
  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("does not compile or check *.test.ts(x), test/** or vitest.config.ts, but still app code", () => {
    const p = keel();
    p.configResolved({ root });
    const bad = "export const x = document.body.innerHTML; export default function T() { return <p>t</p>; }";
    for (const f of ["a.test.ts", "a.test.tsx", "test/a.ts", "modules/m/test/b.tsx", "vitest.config.ts"])
      expect(p.transform(bad, path.join(root, f))).toBeNull();
    expect(() => p.transform(bad, path.join(root, "src/a.tsx"))).toThrow(/E1002/);
  });
});
