// Seed 1337
import fs from "node:fs";
import path from "node:path";
import fc from "fast-check";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { routeLiterals } from "../src/routeLiterals.ts";
import type { SourceFile } from "../src/types/SourceFile.ts";

const PKG = "@keel/std-frag";
const M = "modules/m/routes.ts";
const full = { layout: null, guard: null, actions: [], params: false, search: false };
let root = "";

beforeEach(() => {
  root = fs.mkdtempSync(path.join(import.meta.dirname, ".tmp-fragment-"));
});
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

function put(rel: string, text: string): void {
  const at = path.join(root, rel);
  fs.mkdirSync(path.dirname(at), { recursive: true });
  fs.writeFileSync(at, text);
}

/** `@keel/std-frag` with `exports` `.` and `./routes` naming `src/routes.ts`, whose text is `source`. */
function pkg(source: string): void {
  put(
    `node_modules/${PKG}/package.json`,
    JSON.stringify({ exports: { ".": "./src/routes.ts", "./routes": "./src/routes.ts" } }),
  );
  put(`node_modules/${PKG}/src/routes.ts`, source);
}

/** The app's `modules/m/` with `deps` and a manifest whose text is `source`. */
function app(source: string, deps: readonly string[] = [PKG]): SourceFile[] {
  const mod = `export default module({ id: "m", deps: ${JSON.stringify(deps)}, capabilities: [], public: { exports: [], routes: [] } });\n`;
  return [
    { path: "modules/m/module.ts", source: mod },
    { path: M, source },
  ];
}

const spreading = (body: string, imp = `import { routes as x } from "${PKG}/routes";`, post = ""): string =>
  `${imp}\nexport const routes = manifest({ ${body} });\n${post}`;

describe("routeLiterals package fragments", () => {
  it("reads a guard redirect imported from the package's relative module beside a same-named folder", () => {
    put(`node_modules/${PKG}/src/routes/keep.ts`, "export const k = 1;\n");
    put(
      `node_modules/${PKG}/src/routes/reader.guard.ts`,
      `export const reader = guard({ redirect: "frag.in" }, fn);\n`,
    );
    pkg(
      `import { reader } from "./routes/reader.guard.ts";\nimport { k } from "./routes";\n` +
        `export const routes = manifest({ "frag.in": { path: "/in" }, "frag.list": { path: "/list", guard: reader } });\n`,
    );
    const r = routeLiterals(app(spreading("...x.routes")), { root });
    expect(r).toEqual({
      routes: { "frag.in": { ...full, path: "/in" }, "frag.list": { ...full, path: "/list", guard: "frag.in" } },
      closed: true,
      unread: [],
    });
  });

  it("resolves the package's `.` export and lets later entries override earlier ones in source order", () => {
    pkg(`export const routes = manifest({ "m.a": { path: "/frag" }, "frag.b": { path: "/b" } });\n`);
    const files = app(
      spreading(
        `"m.a": { path: "/a" }, ...x.routes, "frag.b": { path: "/own" }`,
        `import { routes as x } from "${PKG}";`,
      ),
    );
    const r = routeLiterals(files, { root });
    expect(r?.routes).toEqual({ "m.a": { ...full, path: "/frag" }, "frag.b": { ...full, path: "/own" } });
    expect(r?.closed).toBe(true);
  });

  it("unreads the fragment's actions when the app reads actions off the imported binding", () => {
    pkg(`export const routes = manifest({ "frag.a": { path: "/a" } });\n`);
    const r = routeLiterals(app(spreading("...x.routes", undefined, `x.actions({ "frag.a": { POST: f } });`)), {
      root,
    });
    expect(r?.closed).toBe(true);
    expect(r?.unread).toEqual(["frag.a actions"]);
  });

  for (const [name, files, part] of [
    [
      "an export other than routes",
      () => app(spreading("...x.routes", `import { other as x } from "${PKG}/routes";`)),
      "...x.routes",
    ],
    [
      "a package that does not resolve",
      () => app(spreading("...x.routes", `import { routes as x } from "@keel/std-none/routes";`), ["@keel/std-none"]),
      "...x.routes",
    ],
    ["a computed member", () => app(spreading(`...x["routes"]`)), `...x["routes"]`],
    [
      "a relative import",
      () => app(spreading("...x.routes", `import { routes as x } from "./other.ts";`)),
      "...x.routes",
    ],
  ] as const)
    it(`opens on ${name} and names the spread`, () => {
      pkg(`export const routes = manifest({ "frag.a": { path: "/a" } });\n`);
      const r = routeLiterals(files(), { root });
      expect(r).toEqual({ routes: {}, closed: false, unread: [`${M} ${part}`] });
    });

  it("opens on a spread inside the fragment", () => {
    pkg(`import { routes as y } from "@keel/std-other";\nexport const routes = manifest({ ...y.routes });\n`);
    const r = routeLiterals(app(spreading("...x.routes")), { root });
    expect(r).toEqual({ routes: {}, closed: false, unread: [`${PKG}/routes ...y.routes`] });
  });

  /** `@keel/std-frag` whose `./routes` export is `target`, and a literal manifest at `<root>/outside/routes.ts`. */
  const escaping = (target: string): SourceFile[] => {
    put(`node_modules/${PKG}/package.json`, JSON.stringify({ exports: { "./routes": target } }));
    put("outside/routes.ts", `export const routes = manifest({ "frag.out": { path: "/out" } });\n`);
    return app(spreading("...x.routes"));
  };

  for (const target of ["./../../../outside/routes.ts", "../../../outside/routes.ts", "./node_modules/x/routes.ts"])
    it(`opens on an exports target that breaks Node's target rule: ${target}`, () => {
      const r = routeLiterals(escaping(target), { root });
      expect(r).toEqual({ routes: {}, closed: false, unread: [`${M} ...x.routes`] });
    });

  it("opens on an exports target that is a symlink out of the package", () => {
    const files = escaping("./src/routes.ts");
    fs.mkdirSync(path.join(root, `node_modules/${PKG}/src`), { recursive: true });
    fs.symlinkSync(path.join(root, "outside/routes.ts"), path.join(root, `node_modules/${PKG}/src/routes.ts`));
    const r = routeLiterals(files, { root });
    expect(r).toEqual({ routes: {}, closed: false, unread: [`${M} ...x.routes`] });
  });

  it("unreads a guard the fragment imports from outside its package", () => {
    put("outside.ts", `export const reader = guard({ redirect: "frag.a" }, fn);\n`);
    pkg(
      `import { reader } from "../../../../outside.ts";\n` +
        `export const routes = manifest({ "frag.a": { path: "/a", guard: reader } });\n`,
    );
    const r = routeLiterals(app(spreading("...x.routes")), { root });
    expect(r?.routes["frag.a"]).toEqual({ path: "/a", layout: null, actions: [], params: false, search: false });
    expect(r?.unread).toEqual(["frag.a guard"]);
  });

  it("reads the file Node's conditions pick from a `module` and `default` map", () => {
    put(
      `node_modules/${PKG}/package.json`,
      JSON.stringify({ exports: { "./routes": { module: "./esm.ts", default: "./plain.ts" } } }),
    );
    put(`node_modules/${PKG}/esm.ts`, `export const routes = manifest({ "frag.a": { path: "/module" } });\n`);
    put(`node_modules/${PKG}/plain.ts`, `export const routes = manifest({ "frag.a": { path: "/default" } });\n`);
    const r = routeLiterals(app(spreading("...x.routes")), { root });
    expect(r?.routes["frag.a"]?.path).toBe("/default");
  });

  it("reads back exactly the fields of any generated fragment table", () => {
    const verbs = ["DELETE", "PATCH", "POST", "PUT"] as const;
    const word = fc.stringMatching(/^[a-z]{1,6}$/);
    const entry = fc.record({ path: fc.option(word, { nil: undefined }), actions: fc.subarray([...verbs]) });
    fc.assert(
      fc.property(fc.uniqueArray(fc.tuple(word, entry), { maxLength: 6, selector: (t) => t[0] }), (table) => {
        const body = table
          .map(([w, e]) => `"frag.${w}": { ${e.path === undefined ? "" : `path: "/${e.path}"`} }`)
          .join(",\n");
        const acts = table
          .filter(([, e]) => e.actions.length > 0)
          .map(([w, e]) => `"frag.${w}": { ${e.actions.map((v) => `${v}: fn`).join(", ")} }`);
        pkg(
          `export const routes = manifest({ ${body} });\n${acts.length > 0 ? `routes.actions({ ${acts.join(", ")} });` : ""}\n`,
        );
        const r = routeLiterals(app(spreading("...x.routes")), { root });
        const expected = Object.fromEntries(
          table.map(([w, e]) => [
            `frag.${w}`,
            {
              ...full,
              path: e.path === undefined ? null : `/${e.path}`,
              actions: verbs.filter((v) => e.actions.includes(v)),
            },
          ]),
        );
        expect(r).toEqual({ routes: expected, closed: true, unread: [] });
      }),
      { seed: 1337, numRuns: 50 },
    );
  });
});
