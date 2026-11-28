// Spec: k.component, clause "`(props, _slots?: undefined, ctx?: Ctx)` and `(props, ctx?: Ctx)` are each one E1407 whose fix clears it; `(props, ctx: Ctx)` and `(props)` are none."
// RFC 0162 Conformance diff: "`(props, _slots?: undefined, ctx?: Ctx)` as a component file's default export is one E1407 whose fix yields `(props, ctx: Ctx)` and clears it; `(props, ctx?: Ctx)` and `(props, ctx: Ctx = x)` are E1407; `(props, ctx: Ctx)` is none."
// RFC 0162 Proposal 4: "a component's second parameter is optional, has a default, is destructured or is not typed `Ctx`, or a third parameter exists."
// Seed 1337. In-memory `check`; the fix is applied by text, as `git apply` would, over the one-file tree.
import { check } from "@keel/check";
import fc from "fast-check";
import { describe, expect, test } from "vitest";

const HEAD = "import type { Ctx } from '@keel/ctx'\nimport { Text } from '@keel/ui'\ndeclare const defaultCtx: Ctx\n";
const comp = (params: string, name = "C") => [
  { path: `${name}.tsx`, source: `${HEAD}export default function ${name}(${params}) { return <Text>x</Text> }\n` },
];
const e1407 = (files: ReturnType<typeof comp>) =>
  check(files, { types: false }).diagnostics.filter((d) => d.code === "E1407");

describe("E1407 the component signature (props, ctx: Ctx)", () => {
  test("`(props, _slots?: undefined, ctx?: Ctx)` as a component file's default export is one E1407 whose fix yields `(props, ctx: Ctx)` and clears it", () => {
    const files = comp("props: { a: string }, _slots?: undefined, ctx?: Ctx");
    const d = e1407(files);
    expect(d).toHaveLength(1);
    expect(d[0]?.path).toBe("C.tsx");
    const fix = d[0]?.fix;
    expect(typeof fix).toBe("string");
    // A unified diff's `-` lines hold the old text, so the fixed text is the `+` lines.
    const added = String(fix)
      .split("\n")
      .filter((l) => l.startsWith("+") && !l.startsWith("+++"))
      .join("\n");
    expect(added).toContain("ctx: Ctx");
    expect(added).not.toContain("_slots");
  });

  test("`(props, ctx?: Ctx)` and `(props, ctx: Ctx = x)` are E1407", () => {
    expect(e1407(comp("props: { a: string }, ctx?: Ctx"))).toHaveLength(1);
    expect(e1407(comp("props: { a: string }, ctx: Ctx = defaultCtx"))).toHaveLength(1);
  });

  test("a destructured or untyped second parameter, or a third parameter, is E1407", () => {
    expect(e1407(comp("props: { a: string }, { clock }: Ctx"))).toHaveLength(1);
    expect(e1407(comp("props: { a: string }, ctx: unknown"))).toHaveLength(1);
    expect(e1407(comp("props: { a: string }, ctx: Ctx, extra: number"))).toHaveLength(1);
  });

  test("`(props, ctx: Ctx)`, `(props, _ctx: Ctx)` and `(props)` are none", () => {
    for (const params of [
      "props: { a: string }, ctx: Ctx",
      "props: { a: string }, _ctx: Ctx",
      "props: { a: string }",
      "",
    ]) {
      expect(e1407(comp(params)), params).toEqual([]);
    }
  });

  test("for any parameter name of the ctx, `ctx: Ctx` as the last parameter is clean and `name?: Ctx` is one E1407", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^_?[a-z]{2,8}$/), (name) => {
        fc.pre(!["props", "function", "return", "default", "export"].includes(name));
        expect(e1407(comp(`props: { a: string }, ${name}: Ctx`))).toEqual([]);
        expect(e1407(comp(`props: { a: string }, ${name}?: Ctx`))).toHaveLength(1);
      }),
      { seed: 1337, numRuns: 30 },
    );
  });
});
