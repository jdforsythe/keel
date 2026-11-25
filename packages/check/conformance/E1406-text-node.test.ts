// Spec: k.place, Check "A JSX child expression the compiler binds as text (not JSX, not a slot call, not E1403) whose TypeScript type is or may hold a `Node` (a `Node`, a union with one, an array of them) or is a function, is E1406 at the expression, through the check's type pass (as E1453). `any` and `unknown` are not reported. Fix: when the expression is a prop member or a name whose type is a function with no required parameter, append `()`; none otherwise."
// Spec: k.place, Rules "E1406 a JSX child expression bound as text whose type holds a node or is a function (fix: `()` for a function prop or name with no required parameter)."
// Spec: k.place, Conformance "Each one E1406: `{props.icon}` with `icon: () => Node` (fix `{props.icon()}` applies with `git apply` and re-checks clean); `{ok ? props.icon() : null}`; `{makeIcon()}` with `makeIcon(): Node` imported from a project file; `{props.items}` with `items: Node[]`; `{props[k]()}` with a `Node` result; `{f}` with `f: (n: number) => string` (no fix)."
// Spec: k.place, Conformance "None: `{props.icon()}`, `{props.children()}`, `{props.label}` with a string, `{String(n)}`, `{t.title}`, `{x}` with `x: any`, `{formatMoney(m, l)}`, inline JSX, and `{ok && <b/>}` (one E1403 and no E1406)."
// Seed 1337 (the properties below). The type pass is on unless a test says `types: false`.
import { fileURLToPath } from "node:url";
import { check } from "@keel/check";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { applyFix } from "./E1258-support.ts";
import { realFiles } from "./E1406-support.ts";
import { type Files, SEED } from "./support.ts";
import { CHECK_CASE_BOUND } from "./check-time.ts";

type Options = NonNullable<Parameters<typeof check>[1]>;
const NO_TYPES: Options = { types: false };

const UI = "import { Box } from '@keel/ui'\n";
const PATH = "modules/app/Card.tsx";
const file = (path: string, source: string): Files[number] => ({ path, source });

/** A component file: `props` typed `type`, returning `<Box>{expr}</Box>`; `pre` runs before the return. */
const card = (type: string, expr: string, pre = "", head = ""): string =>
  `${UI}${head}export function Card(props: ${type}) {\n  ${pre}\n  return <Box>{${expr}}</Box>\n}\n`;
const files = (source: string, extra: Files = []): Files => [file(PATH, source), ...extra];

const e1406 = (fs: Files, opts: Options = {}) => check(fs, opts).diagnostics.filter((d) => d.code === "E1406");
const countOf = (source: string, opts: Options = {}): number => e1406(files(source), opts).length;
const lineOf = (source: string, needle: string): number => source.split("\n").findIndex((l) => l.includes(needle)) + 1;

describe("k.place Check: each one E1406 at the expression", () => {
  test(
    "`{props.icon}` with `icon: () => Node` is one E1406 at the expression",
    () => {
      const src = card("{ icon: () => Node }", "props.icon");
      const d = e1406(files(src));
      expect(d.length).toBe(1);
      expect(d[0]?.path).toBe(PATH);
      expect(d[0]?.line).toBe(lineOf(src, "props.icon"));
    },
    CHECK_CASE_BOUND,
  );

  test(
    "the fix of `{props.icon}` writes `{props.icon()}`, applies with `git apply` and re-checks clean",
    () => {
      const fs = files(card("{ icon: () => Node }", "props.icon"));
      const d = e1406(fs);
      expect(d.length).toBe(1);
      const fix = d[0]?.fix;
      expect(typeof fix).toBe("string");
      if (fix === undefined) return;
      const patched = applyFix(fs, fix);
      const src = patched.find((f) => f.path === PATH)?.source ?? "";
      expect(src).toContain("{props.icon()}");
      expect(e1406(patched).length).toBe(0);
      expect(check(patched, {}).diagnostics.map((x) => x.code)).not.toContain("E1406");
    },
    CHECK_CASE_BOUND,
  );

  test(
    "`{icon}` with `const icon = props.icon` typed `() => Node` is one E1406 whose fix writes `{icon()}`, which is still E1406 with no fix",
    () => {
      const fs = files(card("{ icon: () => Node }", "icon", "const icon: () => Node = props.icon"));
      const d = e1406(fs);
      expect(d.length).toBe(1);
      const fix = d[0]?.fix;
      expect(typeof fix).toBe("string");
      if (fix === undefined) return;
      const patched = applyFix(fs, fix);
      expect(patched.find((f) => f.path === PATH)?.source ?? "").toContain("{icon()}");
      // `icon()` is a call of a local name, not a slot call, and its type is `Node`: still E1406, and with no fix (k.place Check: the fix is for a function type).
      const after = e1406(patched);
      expect(after.length).toBe(1);
      expect(after[0]?.fix).toBeUndefined();
    },
    CHECK_CASE_BOUND,
  );

  test(
    "`{ok ? props.icon() : null}` is one E1406",
    () => {
      expect(countOf(card("{ ok: boolean; icon: () => Node }", "props.ok ? props.icon() : null"))).toBe(1);
    },
    CHECK_CASE_BOUND,
  );

  test(
    "`{makeIcon()}` with `makeIcon(): Node` imported from a project file is one E1406",
    () => {
      const make = file(
        "modules/app/ui/makeIcon.ts",
        "export function makeIcon(): Node {\n  return document.createElement('b')\n}\n",
      );
      const src = card("{ n: number }", "makeIcon()", "", "import { makeIcon } from './ui/makeIcon.ts'\n");
      expect(e1406(files(src, [make])).length).toBe(1);
    },
    CHECK_CASE_BOUND,
  );

  test(
    "`{props.items}` with `items: Node[]` is one E1406",
    () => {
      expect(countOf(card("{ items: Node[] }", "props.items"))).toBe(1);
    },
    CHECK_CASE_BOUND,
  );

  test(
    "`{props.el}` with `el: Node | string` is one E1406: the type may hold a node",
    () => {
      expect(countOf(card("{ el: Node | string }", "props.el"))).toBe(1);
    },
    CHECK_CASE_BOUND,
  );

  test(
    "`{props[k]()}` with a `Node` result is one E1406",
    () => {
      expect(countOf(card("{ [k: string]: () => Node }", "props[k]()", "const k = 'icon'"))).toBe(1);
    },
    CHECK_CASE_BOUND,
  );

  test(
    "`{f}` with `f: (n: number) => string` is one E1406 with no fix: the function needs an argument",
    () => {
      const d = e1406(files(card("{ f: (n: number) => string }", "props.f")));
      expect(d.length).toBe(1);
      expect(d[0]?.fix).toBeUndefined();
    },
    CHECK_CASE_BOUND,
  );

  test(
    "a function-valued name with a required parameter has no fix, and with none it has one",
    () => {
      const withParam = e1406(files(card("{ icon: (n: number) => Node }", "props.icon")));
      expect(withParam.length).toBe(1);
      expect(withParam[0]?.fix).toBeUndefined();
      const without = e1406(files(card("{ icon: () => Node }", "props.icon")));
      expect(typeof without[0]?.fix).toBe("string");
    },
    CHECK_CASE_BOUND,
  );

  test(
    "a node-holding type in a union, an array of nodes and a function are reported, whatever the member name",
    () => {
      fc.assert(
        fc.property(
          fc.stringMatching(/^[a-z][a-zA-Z]{0,7}$/).filter((n) => !["children", "constructor", "toString"].includes(n)),
          fc.constantFrom(
            "Node",
            "HTMLElement",
            "Node | null",
            "Node[]",
            "(Node | string)[]",
            "() => string",
            "() => Node",
            "Element | undefined",
          ),
          (name, type) => {
            expect(countOf(card(`{ ${name}: ${type} }`, `props.${name}`))).toBe(1);
          },
        ),
        { seed: SEED, numRuns: 40 },
      );
    },
    CHECK_CASE_BOUND,
  );

  test(
    "a value whose type holds no node and is no function is not reported, whatever the member name",
    () => {
      fc.assert(
        fc.property(
          fc.stringMatching(/^[a-z][a-zA-Z]{0,7}$/).filter((n) => !["children", "constructor", "toString"].includes(n)),
          fc.constantFrom(
            "string",
            "number",
            "boolean",
            "string | undefined",
            "string[]",
            "null",
            "'a' | 'b'",
            "bigint",
          ),
          (name, type) => {
            expect(countOf(card(`{ ${name}: ${type} }`, `props.${name}`))).toBe(0);
          },
        ),
        { seed: SEED, numRuns: 40 },
      );
    },
    CHECK_CASE_BOUND,
  );
});

describe("k.place Check: none", () => {
  test(
    "`{props.icon()}` is none",
    () => {
      expect(countOf(card("{ icon: () => Node }", "props.icon()"))).toBe(0);
    },
    CHECK_CASE_BOUND,
  );

  test(
    "`{props.icon?.()}` and `{props.icon() ?? 'x'}` are none: slot calls",
    () => {
      expect(countOf(card("{ icon?: () => Node }", "props.icon?.()"))).toBe(0);
      expect(countOf(card("{ icon: () => Node }", "props.icon() ?? 'x'"))).toBe(0);
    },
    CHECK_CASE_BOUND,
  );

  test(
    "`{props.children()}` is none",
    () => {
      expect(countOf(card("{ children: () => Node }", "props.children()"))).toBe(0);
    },
    CHECK_CASE_BOUND,
  );

  test(
    "`{props.label}` with `label: string` is none",
    () => {
      expect(countOf(card("{ label: string }", "props.label"))).toBe(0);
    },
    CHECK_CASE_BOUND,
  );

  test(
    "`{String(n)}` is none",
    () => {
      expect(countOf(card("{ n: number }", "String(props.n)"))).toBe(0);
    },
    CHECK_CASE_BOUND,
  );

  test(
    "`{t.title}` is none",
    () => {
      expect(countOf(card("{ t: { title: string } }", "props.t.title"))).toBe(0);
    },
    CHECK_CASE_BOUND,
  );

  test(
    "`{n + 1}` is none",
    () => {
      expect(countOf(card("{ n: number }", "props.n + 1"))).toBe(0);
    },
    CHECK_CASE_BOUND,
  );

  test(
    "`{x}` with `x: any` is none",
    () => {
      expect(countOf(card("{ x: any }", "props.x"))).toBe(0);
    },
    CHECK_CASE_BOUND,
  );

  test(
    "`{u}` with `u: unknown` is none",
    () => {
      expect(countOf(card("{ u: unknown }", "props.u"))).toBe(0);
    },
    CHECK_CASE_BOUND,
  );

  test(
    "`{formatMoney(m, l)}` returning a string is none",
    () => {
      const src = card(
        "{ m: number; l: string }",
        "formatMoney(props.m, props.l)",
        "",
        "declare function formatMoney(m: number, l: string): string\n",
      );
      expect(countOf(src)).toBe(0);
    },
    CHECK_CASE_BOUND,
  );

  test(
    "inline JSX as a child is none",
    () => {
      expect(countOf(card("{ n: number }", "<b>x</b>"))).toBe(0);
    },
    CHECK_CASE_BOUND,
  );

  test(
    "`{ok && <b/>}` is one E1403 and no E1406: one diagnostic per fault",
    () => {
      const src = card("{ ok: boolean }", "props.ok && <b />");
      const all = check(files(src), {}).diagnostics;
      expect(all.filter((d) => d.code === "E1403").length).toBe(1);
      expect(all.filter((d) => d.code === "E1406").length).toBe(0);
    },
    CHECK_CASE_BOUND,
  );

  test(
    "a call returning text, a template, a number and a conditional of strings are none",
    () => {
      for (const [type, expr] of [
        ["{ n: number }", "props.n.toFixed(2)"],
        ["{ n: number }", "`${props.n} items`"],
        ["{ a: string; b: string }", "props.a + props.b"],
        ["{ ok: boolean }", "props.ok ? 'yes' : 'no'"],
        ["{ names: string[] }", "props.names.join(', ')"],
        ["{ names: string[] }", "props.names.length"],
        ["{ a?: string }", "props.a ?? 'x'"],
      ] as const) {
        expect(countOf(card(type, expr))).toBe(0);
      }
    },
    CHECK_CASE_BOUND,
  );

  test(
    "each reporting case in a file with the type pass off (`types: false`) is none",
    () => {
      for (const [type, expr] of [
        ["{ icon: () => Node }", "props.icon"],
        ["{ items: Node[] }", "props.items"],
        ["{ el: Node | string }", "props.el"],
        ["{ f: (n: number) => string }", "props.f"],
      ] as const) {
        expect(countOf(card(type, expr), NO_TYPES)).toBe(0);
        expect(countOf(card(type, expr))).toBe(1);
      }
    },
    CHECK_CASE_BOUND,
  );

  test(
    "each reporting case in a `.ts` file with no JSX is none",
    () => {
      for (const [type, expr] of [
        ["{ icon: () => Node }", "props.icon"],
        ["{ items: Node[] }", "props.items"],
        ["{ el: Node | string }", "props.el"],
      ] as const) {
        const src = `export function view(props: ${type}) {\n  return [${expr}]\n}\n`;
        expect(e1406([file("modules/app/view.ts", src)]).length).toBe(0);
      }
    },
    CHECK_CASE_BOUND,
  );

  test(
    "a reporting case in a test file is none",
    () => {
      const src = card("{ icon: () => Node }", "props.icon");
      expect(e1406([file("modules/app/Card.test.tsx", src)]).length).toBe(0);
    },
    CHECK_CASE_BOUND,
  );

  test(
    "a function or node used as an attribute value or a prop, not as a child, is none",
    () => {
      const src = `${UI}export function Card(props: { icon: () => Node; items: Node[] }) {\n  return <Box id="x" onClick={props.icon} data-items={props.items}>x</Box>\n}\n`;
      expect(countOf(src)).toBe(0);
    },
    CHECK_CASE_BOUND,
  );
});

describe("k.place Check: a module of the test's own", () => {
  const FIXTURE = "packages/check/conformance/fixtures/text-children";
  const PACKAGE = fileURLToPath(new URL("../", import.meta.url));

  test(
    "a module whose JSX children are text (strings, numbers, a contract `href`, called slots), with the type pass on, reports no E1406",
    () => {
      const real = realFiles(FIXTURE, "modules/text");
      expect(real.map((x) => x.path).sort()).toEqual(["modules/text/TextCard.tsx", "modules/text/text.contract.ts"]);
      expect(e1406(real, { root: PACKAGE }).length).toBe(0);
    },
    CHECK_CASE_BOUND,
  );

  test(
    "control: the same module with a `Node` child added is one E1406, so the type pass reads the fixture",
    () => {
      const real = realFiles(FIXTURE, "modules/text").map((x) =>
        x.path.endsWith("TextCard.tsx")
          ? {
              ...x,
              source: x.source
                .replace("children: () => string }", "children: () => string; node: Node }")
                .replace("</Box>", '  <Text id="text.node">{props.node}</Text>\n    </Box>'),
            }
          : x,
      );
      expect(e1406(real, { root: PACKAGE }).length).toBe(1);
    },
    CHECK_CASE_BOUND,
  );
});
