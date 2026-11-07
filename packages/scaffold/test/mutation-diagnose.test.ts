// Example tests that pin diagnose, constructorSites and editManifest (backlog 0097). Deterministic; no I/O.
import { describe, expect, it } from "vitest";
import { constructorSites } from "../src/internal/constructorSites.ts";
import { diagnose } from "../src/internal/diagnose.ts";
import { editManifest } from "../src/internal/editManifest.ts";
import { parseSource } from "../src/internal/parseSource.ts";

const manifest = (id: string, deps: string[], exports: string[]): string =>
  `import { module } from '@keel/module'\nexport default module({ id: '${id}', deps: [${deps.map((d) => `'${d}'`).join(", ")}], public: { exports: [${exports.map((e) => `'${e}'`).join(", ")}] } })\n`;

const tree = (extra: Record<string, string>): Map<string, string> =>
  new Map<string, string>([
    ["modules/a/module.ts", manifest("a", ["b"], ["A"])],
    ["modules/b/module.ts", manifest("b", [], ["pub"])],
    ["modules/b/pub.ts", "export const pub = 1\n"],
    ["modules/b/priv.ts", "export const priv = 1\n"],
    ["modules/c/module.ts", manifest("c", [], [])],
    ["modules/c/thing.ts", "export const thing = 1\n"],
    ...Object.entries(extra),
  ]);

describe("diagnose", () => {
  it("is clean for allowed imports and ignores bare specifiers", () => {
    const f = tree({
      "modules/a/x.ts": "import { pub } from '../b/pub.ts'\nimport 'react'\nimport './y.ts'\n",
      "modules/a/y.ts": "export const y = 1\n",
    });
    expect(diagnose(f)).toEqual([]);
  });

  it("reports TS2307 with the import's line", () => {
    const f = tree({ "modules/a/x.ts": "const z = 1\n\nimport { q } from './nope.ts'\n" });
    expect(diagnose(f)).toEqual([
      { code: "TS2307", path: "modules/a/x.ts", line: 3, message: "cannot find module './nope.ts'" },
    ]);
  });

  it("reports E1152 for a module not in deps and E1151 for a non-exported file", () => {
    const f = tree({
      "modules/a/x.ts": "import { thing } from '../c/thing.ts'\nimport { priv } from '../b/priv'\n",
    });
    expect(diagnose(f)).toEqual([
      { code: "E1152", path: "modules/a/x.ts", line: 1, message: "import from module c, not in a deps" },
      { code: "E1151", path: "modules/a/x.ts", line: 2, message: "priv is not a public export of module b" },
    ]);
  });

  it("takes the export name from the first dot-separated part of the file name", () => {
    const f = tree({
      "modules/b/pub.store.ts": "export const s = 1\n",
      "modules/a/x.ts": "import { s } from '../b/pub.store.ts'\n",
    });
    expect(diagnose(f)).toEqual([]);
  });

  it("skips imports outside modules, within one module, and into modules without a manifest", () => {
    const f = tree({
      "modules/a/x.ts": "import { w } from '../../lib/w.ts'\nimport { v } from '../d/v.ts'\n",
      "lib/w.ts": "export const w = 1\n",
      "modules/d/v.ts": "export const v = 1\n",
      "lib/u.ts": "import { thing } from '../modules/c/thing.ts'\n",
      "modules/c/own.ts": "import { thing } from './thing.ts'\n",
    });
    expect(diagnose(f)).toEqual([]);
  });

  it("skips a module whose own manifest is missing even when the target has one", () => {
    const f = tree({ "modules/d/v.ts": "import { thing } from '../c/thing.ts'\n" });
    expect(diagnose(f)).toEqual([]);
    const g = tree({
      "modules/d/module.ts": "export const nothing = 1\n",
      "modules/d/v.ts": "import { thing } from '../c/thing.ts'\n",
    });
    expect(diagnose(g)).toEqual([]);
  });

  it("skips non-code, generated, unparsable, and non-module.ts manifest paths", () => {
    const f = tree({
      "modules/a/readme.md": "import x from './nope'\n",
      ".keel/x.ts": "import x from './nope.ts'\n",
      "modules/a/bad.ts": "import { from './nope.ts'\n",
      "modules/a/types.d.ts": "import x from './nope.ts'\n",
      "modules/e/sub/module.ts": manifest("e", [], []),
      "modules/e/deep/module.ts": manifest("e2", ["zz"], []),
    });
    expect(diagnose(f)).toEqual([]);
  });

  it("reads manifests only at modules/<id>/module.ts", () => {
    const f = new Map<string, string>([
      ["modules/a/module.ts", manifest("a", [], [])],
      ["xmodules/b/module.ts", manifest("b", [], [])],
      ["modules/b/module.tsx", manifest("b", [], [])],
      ["modules/a/x.ts", "import { y } from '../b/y.ts'\n"],
      ["modules/b/y.ts", "export const y = 1\n"],
    ]);
    expect(diagnose(f)).toEqual([]);
  });

  it("reports cycles once each, canonical from the smallest id, sorted, at line 1 of that manifest", () => {
    const f = new Map<string, string>([
      ["modules/c/module.ts", manifest("c", ["a"], [])],
      ["modules/a/module.ts", manifest("a", ["b"], [])],
      ["modules/b/module.ts", manifest("b", ["c"], [])],
      ["modules/x/module.ts", manifest("x", ["y"], [])],
      ["modules/y/module.ts", manifest("y", ["x"], [])],
      ["modules/z/module.ts", manifest("z", ["a", "ghost"], [])],
    ]);
    expect(diagnose(f)).toEqual([
      { code: "E1153", path: "modules/a/module.ts", line: 1, message: "cycle in module deps: a -> b -> c -> a" },
      { code: "E1153", path: "modules/x/module.ts", line: 1, message: "cycle in module deps: x -> y -> x" },
    ]);
  });

  it("reports a self dependency as a one-module cycle and none for a long acyclic chain", () => {
    const self = new Map<string, string>([["modules/a/module.ts", manifest("a", ["a"], [])]]);
    expect(diagnose(self).map((d) => d.message)).toEqual(["cycle in module deps: a -> a"]);
    const chain = new Map<string, string>();
    const ids = ["a", "b", "c", "d", "e"];
    ids.forEach((id, i) =>
      chain.set(`modules/${id}/module.ts`, manifest(id, i + 1 < ids.length ? [ids[i + 1] ?? ""] : [], [])),
    );
    expect(diagnose(chain)).toEqual([]);
  });

  it("orders diagnostics by path", () => {
    const f = tree({
      "modules/a/z.ts": "import './n1.ts'\n",
      "modules/a/m.ts": "import './n2.ts'\n",
    });
    expect(diagnose(f).map((d) => d.path)).toEqual(["modules/a/m.ts", "modules/a/z.ts"]);
  });
});

describe("constructorSites", () => {
  const sites = (src: string, locals: string[]): string[] => {
    const program = parseSource("a.ts", src);
    if (program === null) throw new Error("parse");
    return constructorSites(program, new Set(locals)).map((o) => src.slice(o.start, o.end));
  };

  it("finds store and form(initial) constructors of a local schema, sorted by position", () => {
    const src = [
      "const f = form(Cart, { initial: { b: 2 }, id: 'x' })",
      "const s = store(Cart, { a: 1 })",
      "const o = store(Other, { z: 1 })",
      "const p = store(Cart, other)",
      "const q = form(Cart, { id: 'y' })",
      "const r = form(Cart, { initial: other })",
      "const t = thing(Cart, { w: 1 })",
      "const u = a.store(Cart, { v: 1 })",
      "const v = store('Cart', { v: 1 })",
      "",
    ].join("\n");
    expect(sites(src, ["Cart"])).toEqual(["{ b: 2 }", "{ a: 1 }"]);
  });

  it("finds typed constants, and nothing when the annotation names another schema", () => {
    const src = [
      "const a: typeof Cart.infer = { x: 1 }",
      "const b: Infer<typeof Cart> = { y: 2 }",
      "const c: typeof Other.infer = { n: 1 }",
      "const d: Infer<typeof Other> = { n: 1 }",
      "const e: typeof Cart.infer = other",
      "const f: typeof Cart.output = { n: 1 }",
      "const g: Other<typeof Cart> = { n: 1 }",
      "const h: Infer<Cart> = { n: 1 }",
      "const i: Infer = { n: 1 }",
      "const j: typeof Cart = { n: 1 }",
      "const k: typeof Other.Cart.infer = { n: 1 }",
      "const { m }: typeof Cart.infer = { n: 1 }",
      "const l = { n: 1 }",
      "",
    ].join("\n");
    expect(sites(src, ["Cart"])).toEqual(["{ x: 1 }", "{ y: 2 }"]);
  });

  it("returns nothing for an empty set of locals", () => {
    expect(sites("const s = store(Cart, { a: 1 })\n", [])).toEqual([]);
  });
});

describe("editManifest", () => {
  const change = (d: string[], a: string[], r: string[] = []) => ({
    addDeps: new Set(d),
    addExports: new Set(a),
    removeExports: new Set(r),
  });

  it("appends sorted, new, non-self deps and exports in the existing quote style", () => {
    const src = `import { module } from '@keel/module'\nexport default module({ id: "a", deps: ["b"], public: { exports: ["X"] } })\n`;
    const out = editManifest("modules/a/module.ts", src, change(["d", "c", "b", "a"], ["Z", "Y", "X"]));
    expect(out).toBe(
      `import { module } from '@keel/module'\nexport default module({ id: "a", deps: ["b", "c", "d"], public: { exports: ["X", "Y", "Z"] } })\n`,
    );
  });

  it("fills empty arrays with single quotes", () => {
    const src = "export default module({ id: 'a', deps: [], public: { exports: [] } })\n";
    expect(editManifest("m.ts", src, change(["b"], ["X"]))).toBe(
      "export default module({ id: 'a', deps: ['b'], public: { exports: ['X'] } })\n",
    );
  });

  it("returns the source unchanged when nothing parses or there is no module call", () => {
    expect(editManifest("m.ts", "export default (", change(["b"], []))).toBe("export default (");
    expect(editManifest("m.ts", "export const x = 1\n", change(["b"], []))).toBe("export const x = 1\n");
  });

  it("leaves a manifest without deps or exports arrays alone", () => {
    const src = "export default module({ id: 'a' })\n";
    expect(editManifest("m.ts", src, change(["b"], ["X"], ["Q"]))).toBe(src);
  });

  it("does nothing when every change is already present", () => {
    const src = "export default module({ id: 'a', deps: ['b'], public: { exports: ['X'] } })\n";
    expect(editManifest("m.ts", src, change(["b", "a"], ["X"]))).toBe(src);
  });

  it("rewrites exports when removing, keeping quote style, and keeps what is added back", () => {
    const src = `export default module({ id: 'a', deps: [], public: { exports: ["X", "Y", "Z"] } })\n`;
    expect(editManifest("m.ts", src, change([], ["W"], ["Y"]))).toBe(
      `export default module({ id: 'a', deps: [], public: { exports: ["X", "Z", "W"] } })\n`,
    );
    expect(editManifest("m.ts", src, change([], ["Y"], ["Y", "Q"]))).toBe(src);
    const single = "export default module({ id: 'a', deps: [], public: { exports: ['X', 'Y'] } })\n";
    expect(editManifest("m.ts", single, change([], [], ["X"]))).toBe(
      "export default module({ id: 'a', deps: [], public: { exports: ['Y'] } })\n",
    );
  });

  it("removing every export leaves an empty array", () => {
    const src = "export default module({ id: 'a', deps: [], public: { exports: ['X'] } })\n";
    expect(editManifest("m.ts", src, change([], [], ["X"]))).toBe(
      "export default module({ id: 'a', deps: [], public: { exports: [] } })\n",
    );
  });
});
