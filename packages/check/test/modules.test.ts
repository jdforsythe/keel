// k.module pass (E1151-E1157): examples, fixes, and edge cases beyond the conformance suite.
import { describe, expect, it } from "vitest";
import { type Diagnostic, type SourceFile, check } from "../src/index.ts";
import { applyPatch } from "./support/applyPatch.ts";

const f = (path: string, source: string): SourceFile => ({ path, source });
const list = (xs: string[]): string => `[${xs.map((x) => `'${x}'`).join(", ")}]`;
const man = (id: string, o: { deps?: string[]; caps?: string[]; exports?: string[]; routes?: string[] } = {}) =>
  f(
    `modules/${id}/module.ts`,
    `import { module } from '@keel/compiler'\nexport default module({\n  id: '${id}',\n  deps: ${list(o.deps ?? [])},\n  capabilities: ${list(o.caps ?? [])},\n  public: { exports: ${list(o.exports ?? [])}, routes: ${list(o.routes ?? [])} },\n})\n`,
  );
const run = (files: SourceFile[]): readonly Diagnostic[] => check(files, { types: false }).diagnostics;
const of = (files: SourceFile[], code: string): readonly Diagnostic[] => run(files).filter((d) => d.code === code);

/** Apply a diagnostic's fix to the file it names and return the new file list. */
function applyFix(files: SourceFile[], d: Diagnostic | undefined): SourceFile[] {
  const fix = d?.fix;
  if (fix === undefined) throw new Error("no fix");
  const target = /^--- a\/(.+)$/m.exec(fix)?.[1];
  return files.map((x) => (x.path === target ? f(x.path, applyPatch(x.path, x.source, fix)) : x));
}

describe("module pass", () => {
  it("E1152 fix adds the module to deps; re-checking is clean", () => {
    const files = [
      man("catalog", { exports: ["Item"] }),
      f("modules/catalog/Item.ts", "export const Item = 1\n"),
      man("orders"),
      f("modules/orders/Card.ts", "import { Item } from '../catalog/Item.ts'\nexport const Card = Item\n"),
    ];
    const d = of(files, "E1152");
    expect(d.map((x) => [x.path, x.line, x.message])).toEqual([
      ["modules/orders/Card.ts", 1, "module orders imports from catalog, which is not in its deps"],
    ]);
    const fixed = applyFix(files, d[0]);
    expect(fixed.find((x) => x.path === "modules/orders/module.ts")?.source).toContain("deps: ['catalog']");
    expect(of(fixed, "E1152")).toEqual([]);
  });

  it("E1152 fix appends to a non-empty deps list", () => {
    const files = [
      man("catalog", { exports: ["Item"] }),
      f("modules/catalog/Item.ts", "export const Item = 1\n"),
      man("users"),
      man("orders", { deps: ["users"] }),
      f("modules/orders/Card.ts", "import { Item } from '../catalog/Item.ts'\nexport const Card = Item\n"),
    ];
    const fixed = applyFix(files, of(files, "E1152")[0]);
    expect(fixed.find((x) => x.path === "modules/orders/module.ts")?.source).toContain("deps: ['users', 'catalog']");
  });

  it("E1154 fix removes the missing entry (first, middle, last, only)", () => {
    for (const exports of [["Ghost"], ["Ghost", "Item"], ["Item", "Ghost"], ["Item", "Ghost", "Card"]]) {
      const files = [
        man("catalog", { exports }),
        f("modules/catalog/Item.ts", "export const Item = 1\n"),
        f("modules/catalog/Card.ts", "export const Card = 1\n"),
      ];
      const d = of(files, "E1154");
      expect(d).toHaveLength(1);
      expect(d[0]?.message).toBe("module catalog public.exports names Ghost, which does not exist");
      const fixed = applyFix(files, d[0]);
      const after = fixed.find((x) => x.path === "modules/catalog/module.ts")?.source ?? "";
      expect(after).toContain(`exports: ${list(exports.filter((x) => x !== "Ghost"))}`);
      expect(of(fixed, "E1154")).toEqual([]);
    }
  });

  it("E1156 fix adds the capability; destructured ctx counts as a use; one report per capability", () => {
    const files = [
      man("orders", { caps: ["clock"] }),
      f(
        "modules/orders/load.ts",
        "export const load = (ctx: never) => {\n  const { net } = ctx\n  return [ctx.net, ctx.clock, net]\n}\n",
      ),
    ];
    const d = of(files, "E1156");
    expect(d.map((x) => [x.line, x.message])).toEqual([
      [2, "module orders uses ctx.net but it is not in its capabilities"],
    ]);
    const fixed = applyFix(files, d[0]);
    expect(fixed.find((x) => x.path === "modules/orders/module.ts")?.source).toContain(
      "capabilities: ['clock', 'net']",
    );
    expect(of(fixed, "E1156")).toEqual([]);
  });

  it("E1153 names a self-dependency and reports once per cycle", () => {
    expect(of([man("orders", { deps: ["orders"] })], "E1153").map((d) => d.message)).toEqual([
      "module deps cycle: orders -> orders",
    ]);
    const files = [man("aa", { deps: ["bb", "cc"] }), man("bb", { deps: ["aa"] }), man("cc", { deps: ["aa"] })];
    const d = of(files, "E1153");
    expect(d.map((x) => [x.path, x.message])).toEqual([["modules/aa/module.ts", "module deps cycle: aa -> bb -> aa"]]);
  });

  it("E1153 ignores deps naming no discovered module", () => {
    expect(of([man("orders", { deps: ["@keel/std-auth", "ghost"] })], "E1153")).toEqual([]);
  });

  it("E1151 also covers re-exports and literal dynamic imports", () => {
    const files = [
      man("catalog"),
      f("modules/catalog/Secret.ts", "export const Secret = 1\n"),
      man("orders", { deps: ["catalog"] }),
      f("modules/orders/Again.ts", "export { Secret as Again } from '../catalog/Secret.ts'\n"),
      f("modules/orders/Lazy.ts", "export const Lazy = () => import('../catalog/Secret.ts')\n"),
    ];
    expect(of(files, "E1151").map((d) => d.path)).toEqual(["modules/orders/Again.ts", "modules/orders/Lazy.ts"]);
  });

  it("files outside every module and test files are not checked", () => {
    const files = [
      man("catalog"),
      f("modules/catalog/Secret.ts", "export const Secret = 1\n"),
      man("orders"),
      f("src/main.ts", "import { Secret } from '../modules/catalog/Secret.ts'\nexport const main = Secret\n"),
      f(
        "modules/orders/test/Card.test.ts",
        "import { Secret } from '../../catalog/Secret.ts'\nexport const x = Secret\n",
      ),
    ];
    const codes = run(files).map((d) => d.code);
    expect(codes.filter((c) => /^E115/.test(c))).toEqual([]);
  });

  it("an opaque (non-literal) manifest is not enforced and does not crash", () => {
    const files = [
      f(
        "modules/catalog/module.ts",
        "import { module } from '@keel/compiler'\nimport def from './def.ts'\nexport default module(def)\n",
      ),
      f("modules/catalog/Secret.ts", "export const Secret = 1\n"),
      man("orders", { deps: ["catalog"] }),
      f("modules/orders/Card.ts", "import { Secret } from '../catalog/Secret.ts'\nexport const Card = Secret\n"),
    ];
    expect(run(files).filter((d) => /^E115/.test(d.code))).toEqual([]);
  });

  it("without any manifest the pass reports nothing", () => {
    const files = [f("modules/orders/Run.ts", "export const Run = (ctx: never) => ctx.net\n")];
    expect(run(files).filter((d) => /^E115/.test(d.code))).toEqual([]);
  });

  it("E1155 reads store ids, transaction names, and error codes only from their kernel imports", () => {
    const files = [
      man("orders"),
      f(
        "modules/orders/cart.ts",
        "const store = (...a: unknown[]) => a\nexport const cart = store({}, {}, { id: 'cart' })\n",
      ),
    ];
    expect(of(files, "E1155")).toEqual([]);
  });

  it("every module diagnostic is one line under 90 chars and cites k.module, even with long ids", () => {
    const long = "a".repeat(40);
    const files = [
      man(long, { deps: [`${long}b`], exports: ["G".repeat(50)], routes: ["r".repeat(50)] }),
      man(`${long}b`, { deps: [long] }),
      f(`modules/${long}/Run.ts`, `export const Run = (ctx: never) => ctx.${"x".repeat(50)}\n`),
    ];
    const d = run(files).filter((x) => /^E115/.test(x.code));
    expect(d.length).toBeGreaterThanOrEqual(3);
    for (const x of d) {
      expect(x.message.length).toBeLessThan(90);
      expect(x.message).not.toContain("\n");
      expect(x.see).toBe("k.module");
    }
  });
});
