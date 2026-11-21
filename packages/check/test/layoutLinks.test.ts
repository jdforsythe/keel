import { describe, expect, it } from "vitest";
import { check } from "../src/index.ts";
import type { SourceFile } from "../src/index.ts";
import { bindingFile, contractFile, mod, topologyFile } from "./support/moduleFixtures.ts";

const SHELL = contractFile("a", "'a.shell': { layout: true }, 'a.home': { path: '/' }");
const SHELL_BOUND = bindingFile("a", "'a.shell': { component: Page }, 'a.home': { component: Page }");
const pageIn = (layout: string): SourceFile[] => [
  contractFile("b", "'b.home': { path: '/b' }"),
  bindingFile("b", `'b.home': { component: Page, layout: '${layout}' }`),
];
const diags = (files: SourceFile[], code: string) =>
  check(files, { types: false }).diagnostics.filter((d) => d.code === code);

describe("a binding's layout of another module", () => {
  it("needs that module in deps: E1152 at layout, the fix adds it", () => {
    const ds = diags([mod("a"), mod("b"), SHELL, SHELL_BOUND, ...pageIn("a.shell")], "E1152");
    expect(ds.map((d) => [d.path, d.line])).toEqual([["modules/b/routes.ts", 4]]);
    expect(ds[0]?.fix).toContain("deps: ['a']");
    expect(diags([mod("a"), mod("b", ["a"]), SHELL, SHELL_BOUND, ...pageIn("a.shell")], "E1152")).toEqual([]);
  });

  it("a layout of the own module needs no deps", () => {
    const own = bindingFile("a", "'a.shell': { component: Page }, 'a.home': { component: Page, layout: 'a.shell' }");
    expect(diags([mod("a"), SHELL, own], "E1152")).toEqual([]);
  });

  it("E1506 when it names no layout entry of the joined table", () => {
    const base = [mod("a"), mod("b", ["a"]), SHELL, SHELL_BOUND];
    expect(diags([...base, ...pageIn("a.ghost")], "E1506").map((d) => d.path)).toEqual(["modules/b/routes.ts"]);
    expect(diags([...base, ...pageIn("a.home")], "E1506")).toHaveLength(1);
    expect(diags([...base, ...pageIn("a.shell")], "E1506")).toEqual([]);
  });

  it("E1506 when the layout's module is placed in another deployable; none when placed together", () => {
    const base = [mod("a"), mod("b", ["a"]), SHELL, SHELL_BOUND, ...pageIn("a.shell")];
    expect(diags([...base, topologyFile({ web: ["b"], admin: ["a"] })], "E1506")).toHaveLength(1);
    expect(diags([...base, topologyFile({ web: ["a", "b"] })], "E1506")).toEqual([]);
  });

  it("E1506 when layouts of two modules close a cycle", () => {
    const files = [
      mod("a", ["b"]),
      mod("b", ["a"]),
      contractFile("a", "'a.shell': { layout: true }"),
      bindingFile("a", "'a.shell': { component: Page, layout: 'b.shell' }"),
      contractFile("b", "'b.shell': { layout: true }"),
      bindingFile("b", "'b.shell': { component: Page, layout: 'a.shell' }"),
    ];
    const ds = diags(files, "E1506");
    expect(ds.map((d) => d.path).sort()).toEqual(["modules/a/routes.ts", "modules/b/routes.ts"]);
    expect(ds[0]?.message).toContain("cycle");
  });
});
