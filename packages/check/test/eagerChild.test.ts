// Backlog 0188 (rfc:0069): E1808 flags a base element whose `children` is made before it. Cases past the conformance
// clause: conditional and logical values, shadowed and type-only imports, test files, the message and the fix text.
import { describe, expect, it } from "vitest";
import { check } from "../src/index.ts";
import { applyPatch } from "./support/applyPatch.ts";

const UI = "import { Box, Text, Input } from '@keel/ui'\n";
const IN = "Input({ label: 'L', onInput: () => undefined })";
const page = (body: string, head = UI): string => `${head}export default function Page() { ${body} }\n`;
const e1808 = (source: string, path = "modules/app/Page.ts") =>
  check([{ path, source }], { types: false }).diagnostics.filter((d) => d.code === "E1808");

describe("E1808 eager base-element children (backlog 0188)", () => {
  it("reports at the value with a message naming the parent, and its fix wraps the value in a thunk", () => {
    const src = page(`return Box({ p: '1', children: ${IN} })`);
    const [d] = e1808(src);
    expect(d?.message).toBe("Box children made before it; pass a thunk: children: () => ...");
    expect([d?.line, d?.col]).toEqual([2, (src.split("\n")[1] ?? "").indexOf("Input") + 1]);
    const fixed = applyPatch("modules/app/Page.ts", src, d?.fix ?? "");
    expect(fixed).toContain(`children: () => ${IN}`);
    expect(e1808(fixed)).toEqual([]);
  });

  it("flags conditional and logical values holding an element, with a fix", () => {
    for (const v of [`ok ? ${IN} : 'none'`, `ok && ${IN}`, `(${IN})`]) {
      const src = page(`const ok = true\n return Box({ children: ${v} })`);
      const ds = e1808(src);
      expect(ds).toHaveLength(1);
      expect(e1808(applyPatch("modules/app/Page.ts", src, ds[0]?.fix ?? ""))).toEqual([]);
    }
  });

  it("a binding has no fix: a thunk returning it would still return a node made first", () => {
    for (const body of [
      `const f = ${IN}\n return Box({ children: f })`,
      `const children = [${IN}]\n return Box({ children })`,
    ]) {
      const ds = e1808(page(body));
      expect(ds).toHaveLength(1);
      expect(ds[0]?.fix).toBeUndefined();
    }
  });

  it("is clean for a shadowed Box, a type-only import, a non-element call, a parameter and a test file", () => {
    expect(e1808(page(`const Box = (o: { children: unknown }) => o\n return Box({ children: ${IN} })`))).toEqual([]);
    const typeOnly = "import type { Box } from '@keel/ui'\nimport { Input } from '@keel/ui'\n";
    expect(e1808(page(`return (Box as any)({ children: ${IN} })`, typeOnly))).toEqual([]);
    expect(e1808(page("return Box({ children: String(1) })"))).toEqual([]);
    expect(e1808(`${UI}export default function Page(kid: Node) { return Box({ children: kid }) }\n`)).toEqual([]);
    expect(e1808(page(`return Box({ children: ${IN} })`), "modules/app/Page.test.ts")).toEqual([]);
  });

  it("flags each level of nested eager children, and a Text or Button parent", () => {
    expect(e1808(page(`return Box({ children: Box({ children: ${IN} }) })`))).toHaveLength(2);
    expect(e1808(page("return Text({ children: Text({ children: 'a' }) })"))).toHaveLength(1);
  });

  describe("red-team forms (backlog 0201)", () => {
    const RT = "import { For, If, Match } from '@keel/runtime-dom'\n";
    it("flags a For, If or Match call as children: k.runtime builds them at the call", () => {
      for (const v of [
        `For({ each: xs, key: "id", children: (x) => ${IN} })`,
        `If({ when: true, children: () => ${IN} })`,
        "Match({ on: v, cases: {} })",
      ]) {
        const src = page(`const xs = []\n const v = 1\n return Box({ children: ${v} })`, UI + RT);
        const ds = e1808(src);
        expect(ds).toHaveLength(1);
        expect(e1808(applyPatch("modules/app/Page.ts", src, ds[0]?.fix ?? ""))).toEqual([]);
      }
      // A For used as the parent is not a base element; its own children are a function.
      expect(e1808(page(`return For({ each: [], key: "id", children: (x) => ${IN} })`, UI + RT))).toEqual([]);
    });

    it("flags elements from a destructured namespace import, renamed or not", () => {
      const head = "import * as ui from '@keel/ui'\nimport * as rt from '@keel/runtime-dom'\n";
      expect(e1808(page(`const { Box, Input } = ui\n return Box({ children: ${IN} })`, head))).toHaveLength(1);
      expect(
        e1808(page(`const { Box: B, Text: T } = ui\n return B({ children: T({ children: 'a' }) })`, head)),
      ).toHaveLength(1);
      expect(
        e1808(
          page(
            `const { For } = rt\n return ui.Box({ children: For({ each: [], key: "id", children: () => 'a' }) })`,
            head,
          ),
        ),
      ).toHaveLength(1);
      expect(e1808(page(`const { Box, Input } = ui\n return Box({ children: () => ${IN} })`, head))).toEqual([]);
      // A destructured local object that is not the namespace is not followed.
      expect(e1808(page(`const { Box } = { Box: ui.Text }\n return Box({ children: ${IN} })`, head))).toEqual([]);
    });

    it("flags a const props object passed to a base element, with a fix in the literal", () => {
      const src = page(`const opts = { p: '1', children: ${IN} }\n return Box(opts)`);
      const ds = e1808(src);
      expect(ds).toHaveLength(1);
      expect(ds[0]?.line).toBe(2);
      expect(e1808(applyPatch("modules/app/Page.ts", src, ds[0]?.fix ?? ""))).toEqual([]);
      expect(e1808(page(`const opts = { children: () => ${IN} }\n return Box(opts)`))).toEqual([]);
    });

    it("documented limits: a member of an object, array destructuring and an IIFE are not followed", () => {
      expect(e1808(page(`const o = { f: ${IN} }\n return Box({ children: o.f })`))).toEqual([]);
      expect(e1808(page(`const [f] = [${IN}]\n return Box({ children: f })`))).toEqual([]);
      expect(e1808(page(`return Box({ children: (() => ${IN})() })`))).toEqual([]);
    });
  });
});
