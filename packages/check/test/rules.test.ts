import { canonicalJson, hashOf } from "@keel/compiler/internal";
import { describe, expect, it } from "vitest";
import type { SourceFile } from "../src/index.ts";
import { applyPatch } from "./support/applyPatch.ts";
import { checkNoThrow as check } from "./support/checkNoThrow.ts";

// Built so the factory's own lint does not read fixture text as a call in this file.
const UNSAFE = "unsafe";
const NOW = ["Date", "now"].join(".");

type Case = { code: string; bad: SourceFile[]; clean: SourceFile[]; fix?: true };
const f = (path: string, source: string): SourceFile => ({ path, source });
const codesOf = (x: SourceFile): string[] => check([x], { types: false }).diagnostics.map((d) => d.code);

const CASES: Case[] = [
  {
    code: "E1104",
    bad: [f("src/User.ts", "import { s } from '@keel/schema'\nexport const User = s.object({ name: s.string() })\n")],
    clean: [
      f("src/User.schema.ts", "import { s } from '@keel/schema'\nexport const User = s.object({ name: s.string() })\n"),
    ],
  },
  {
    code: "E1302",
    bad: [
      f(
        "src/addItem.ts",
        `import { transaction } from '@keel/store'\nexport const addItem = transaction(cart, 'cart.addItem', Item, (state) => ({ ...state, at: ${NOW}() }))\n`,
      ),
    ],
    clean: [
      f(
        "src/addItem.ts",
        "import { transaction } from '@keel/store'\nexport const addItem = transaction(cart, 'cart.addItem', Item, (state, p) => ({ ...state, at: p.at }))\n",
      ),
    ],
  },
  {
    code: "E1451",
    bad: [f("src/f.ts", "export function f(n: number) {\n  if (n < 0) throw new Error('neg')\n  return n\n}\n")],
    clean: [f("src/f.ts", "export function f(n: number) {\n  return n\n}\n")],
    fix: true,
  },
  {
    code: "E1452",
    bad: [
      f(
        "src/f.ts",
        "export async function f(p: Promise<number>) {\n  try {\n    return await p\n  } catch (e) {\n    return 0\n  }\n}\n",
      ),
    ],
    clean: [f("src/f.ts", "export function f() {\n  return 1\n}\n")],
    fix: true,
  },
  {
    code: "E1452",
    bad: [f("src/f.ts", "export const f = (p: Promise<number>) => p.catch(() => 0)\n")],
    clean: [f("src/f.ts", "export const f = (p: Promise<number>) => p\n")],
  },
  {
    code: "E1453",
    bad: [
      f(
        "src/f.ts",
        "import { ok, type Result } from '@keel/schema'\nconst save = (): Result<number, string> => ok(1)\nsave()\n",
      ),
    ],
    clean: [
      f(
        "src/f.ts",
        "import { ok, type Result } from '@keel/schema'\nconst save = (): Result<number, string> => ok(1)\nconst r = save()\nvoid r\n",
      ),
    ],
  },
  {
    code: "E1454",
    bad: [
      f(
        "src/a.schema.ts",
        "import { s } from '@keel/schema'\nexport const a = s.error('orders.locked', s.object({}))\n",
      ),
      f(
        "src/b.schema.ts",
        "import { s } from '@keel/schema'\nexport const b = s.error('orders.locked', s.object({}))\n",
      ),
    ],
    clean: [
      f(
        "src/a.schema.ts",
        "import { s } from '@keel/schema'\nexport const a = s.error('orders.locked', s.object({}))\n",
      ),
      f(
        "src/b.schema.ts",
        "import { s } from '@keel/schema'\nexport const b = s.error('orders.closed', s.object({}))\n",
      ),
    ],
  },
  {
    code: "E1601",
    bad: [f("src/roll.ts", "export const roll = () => Math.random()\n")],
    clean: [f("src/roll.ts", "export const roll = (ctx: { random: { float(): number } }) => ctx.random.float()\n")],
    fix: true,
  },
  {
    code: "E1601",
    bad: [f("test/a.test.ts", "const r = Math.random()\nvoid r\n")],
    clean: [f("test/a.test.ts", "const r = 0.5\nvoid r\n")],
    fix: true,
  },
  {
    code: "E1701",
    bad: [f("test/cart.test.ts", "const el = document.querySelector('#total')\nvoid el\n")],
    clean: [f("test/cart.test.ts", "const t = { find: (id: string) => id }\nvoid t.find('cart.total')\n")],
  },
  {
    code: "E1752",
    bad: [f("src/a.ts", "export const a = 1\nexport const b = 2\n")],
    clean: [f("src/a.ts", "export const a = 1\n")],
  },
  {
    code: "E1753",
    bad: [f("src/rule.ts", "defineRule({ code: 'E1999', message: 'm', explain: 'e', check: () => [] })\n")],
    clean: [f("src/rule.ts", "defineRule({ code: 'E2001', message: 'm', explain: 'e', check: () => [] })\n")],
  },
  {
    code: "E1754",
    bad: [f("src/x.ts", `export const x = ${UNSAFE}(() => 1)\n`)],
    clean: [f("src/x.ts", `export const x = ${UNSAFE}('reason', () => 1)\n`)],
  },
  {
    code: "E1757",
    bad: [f("src/x.ts", "declare const m: { a?: number }\nexport const x: any = m.a!\n")],
    clean: [f("src/x.ts", "declare const m: { a?: number }\nexport const x: unknown = m.a\n")],
    fix: true,
  },
  {
    code: "E1803",
    bad: [
      f(
        "src/C.tsx",
        "import { Box } from '@keel/ui'\nexport default function C() { return <Box style={{}}>x</Box> }\n",
      ),
    ],
    clean: [
      f("src/C.tsx", "import { Box } from '@keel/ui'\nexport default function C() { return <Box p=\"2\">x</Box> }\n"),
    ],
  },
  {
    code: "E1805",
    bad: [
      f(
        "src/C.tsx",
        "import { Box } from '@keel/ui'\nexport default function C() {\n  return <Box><h2>Orders</h2><span>x</span></Box>\n}\n",
      ),
    ],
    clean: [
      f("src/C.tsx", "import { Box } from '@keel/ui'\nexport default function C() {\n  return <Box>Orders</Box>\n}\n"),
    ],
    fix: true,
  },
];

describe("kernel rules", () => {
  for (const c of CASES) {
    it(`${c.code}: ${c.bad[0]?.path} triggers it; the clean counterpart does not`, () => {
      expect(check(c.bad, {}).diagnostics.map((d) => d.code)).toContain(c.code);
      expect(check(c.clean, {}).diagnostics.map((d) => d.code)).not.toContain(c.code);
    });
    if (c.fix === true) {
      it(`${c.code}: every fix applies with git apply and clears that diagnostic`, () => {
        const file = c.bad[0];
        if (file === undefined) throw new Error("case without a file");
        let source = file.source;
        for (let i = 0; i < 5; i++) {
          const d = check([{ path: file.path, source }], {}).diagnostics.find((x) => x.code === c.code);
          if (d === undefined) break;
          expect(typeof d.fix).toBe("string");
          source = applyPatch(file.path, source, d.fix ?? "");
        }
        expect(check([{ path: file.path, source }], {}).diagnostics.map((d) => d.code)).not.toContain(c.code);
      });
    }
  }

  it("E1805 has no exceptions: an external <a> names Link, and it fires beside compiler codes", () => {
    const a = check([f("C.tsx", 'export default function C() { return <a href="https://example.com">x</a> }\n')], {});
    expect(a.diagnostics.map((d) => [d.code, d.message])).toEqual([
      ["E1805", "<a> in app code; use <Link> from @keel/ui"],
    ]);
    const src = "export default function C(props) { return <div>{props.a && <b/>}</div> }\n";
    expect(
      check([f("C.tsx", src)], {})
        .diagnostics.map((d) => d.code)
        .sort(),
    ).toEqual(["E1403", "E1805", "E1805"]);
  });

  it("E1805: nav and aside get no fix, since Box requires a label there", () => {
    for (const tag of ["nav", "aside"]) {
      const src = `export default function C() { return <${tag}>x</${tag}> }\n`;
      const d = check([f("C.tsx", src)], {}).diagnostics.filter((x) => x.code === "E1805");
      expect(d.length).toBe(1);
      expect(d[0]?.fix).toBeUndefined();
    }
  });

  it("E1757: suppression comments are removed by the fix; as const is not a cast", () => {
    const src = `// @ts-${"ignore"}\nexport const x: number = 'a' // @ts-${"expect-error"}\n`;
    const d = check([f("src/x.ts", src)], { types: false }).diagnostics.filter((x) => x.code === "E1757");
    expect(d.map((x) => x.line)).toEqual([1, 2]);
    expect(applyPatch("src/x.ts", src, d[0]?.fix ?? "")).toBe("export const x: number = 'a' // @ts-expect-error\n");
    expect(codesOf(f("src/y.ts", "export const y = [1] as const\n"))).not.toContain("E1757");
  });

  it("E1752: a re-export outside index.ts is reported; index.ts and types/ may re-export", () => {
    expect(codesOf(f("src/a.ts", "export { b } from './b.ts'\n"))).toContain("E1752");
    expect(codesOf(f("src/a.ts", "export * from './b.ts'\n"))).toContain("E1752");
    expect(codesOf(f("src/index.ts", "export { b } from './b.ts'\n"))).not.toContain("E1752");
    expect(codesOf(f("src/types/B.ts", "export type { B } from './B.ts'\n"))).not.toContain("E1752");
  });

  it("E1752: a *.server.ts exporting only loader and action is exempt", () => {
    const server = "export const loader = () => 1\nexport const action = () => 2\n";
    expect(check([f("src/orders/show.server.ts", server)], {}).diagnostics.map((d) => d.code)).not.toContain("E1752");
    const extra = `${server}export const helper = 3\n`;
    expect(check([f("src/orders/show.server.ts", extra)], {}).diagnostics.map((d) => d.code)).toContain("E1752");
  });

  it("E1752: a component file (.tsx or PascalCase .ts) may export Props and uses beside its default; a schema file its type alias", () => {
    const codes = (x: SourceFile): string[] => check([x], { types: false }).diagnostics.map((d) => d.code);
    const comp = "export const Props = 1\nexport const uses = []\nexport default function Row() {\n  return null\n}\n";
    expect(codes(f("src/Row.tsx", comp))).not.toContain("E1752");
    expect(codes(f("src/Row.tsx", `${comp}export const other = 1\n`))).toContain("E1752");
    // A PascalCase plain `.ts` whose default takes `Props` is a component file too (rfc:0068); others are not.
    const tsComp = comp.replace("Row()", "Row(props: Props)");
    expect(codes(f("src/Row.ts", tsComp))).not.toContain("E1752");
    expect(codes(f("src/Row.ts", comp))).toContain("E1752");
    expect(codes(f("src/Row.ts", `${tsComp}export const other = 1\n`))).toContain("E1752");
    expect(codes(f("src/row.ts", tsComp.replace("Row(", "row(")))).toContain("E1752");
    expect(codes(f("src/Row.server.ts", tsComp))).toContain("E1752");
    const schema = "export const Todo = s.object({})\nexport type Todo = Infer<typeof Todo>\n";
    expect(codes(f("src/Todo.schema.ts", schema))).not.toContain("E1752");
    expect(codes(f("src/Todo.schema.ts", `${schema}export const Other = 1\n`))).toContain("E1752");
  });

  it("E1004 is not reported in a client-only deployable when the topology is passed", () => {
    const routes = f(
      "modules/todos/view.ts",
      "import { loadList } from './loadList.server.ts'\nexport const routes = loadList\n",
    );
    const server = f("modules/todos/loadList.server.ts", "export const loader = () => 1\n");
    const codes = (o: object): string[] =>
      check([routes, server], { types: false, ...o }).diagnostics.map((d) => d.code);
    expect(codes({})).toContain("E1004");
    expect(codes({ topology: { web: { modules: ["todos"], adapter: "client" } } })).not.toContain("E1004");
  });

  it("E1005: a .keel/ artifact whose bytes or hash differ from what the compiler writes", () => {
    // No sources: the compiler's ids.json is `{}` (rfc:0050).
    const good = `{"data":{},"hash":"${hashOf({})}"}\n`;
    const codes = (source: string, artifacts = {}) =>
      check([f(".keel/ids.json", source)], { artifacts }).diagnostics.map((d) => d.code);
    expect(codes(good)).toEqual([]);
    expect(codes(good.replace('"data":{}', '"data":{"C.0":{"col":1}}'))).toEqual(["E1005"]);
    // 0143 repro: a caller's hashes never replace the derivation, so `{}` or a matching forged hash stays E1005.
    const data = { "C.0": { col: 1 } };
    const forged = `${canonicalJson({ data, hash: hashOf(data) })}\n`;
    expect(codes(forged, { hashes: {} })).toEqual(["E1005"]);
    expect(codes(forged, { hashes: { "ids.json": hashOf(data) } })).toEqual(["E1005"]);
    expect(codes(good, { hashes: { "ids.json": "fnv1a:00000000" } })).toEqual([]);
    const spaced = good.replace('{"data"', '{ "data"');
    const d = check([f(".keel/ids.json", spaced)], {}).diagnostics;
    expect(d.map((x) => x.code)).toEqual(["E1005"]);
    expect(applyPatch(".keel/ids.json", spaced, d[0]?.fix ?? "")).toBe(good);
  });

  it("E1755: a measured budget over its limit is reported at its path", () => {
    const budgets = [
      { id: "check.injected10", limit: 600, actual: 640, unit: "tokens" as const },
      { id: "@keel/ui", limit: 6000, actual: 10, unit: "bytes" as const, path: "packages/ui" },
    ];
    const d = check([], { budgets }).diagnostics;
    expect(d.map((x) => [x.code, x.path])).toEqual([["E1755", "budgets.json"]]);
    expect(d[0]?.message).toContain("640 tokens > 600");
  });

  it("E1756: a throwing rule message stays under 90 chars whatever it threw", () => {
    const d = check([f("a.ts", "x\n")], {}).diagnostics;
    for (const x of d) expect(x.message.length).toBeLessThan(90);
  });
});
