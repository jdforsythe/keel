// k.compiler Artifacts: a placed stdlib module's routes are read statically from its package's `./contract` and
// `./routes` files, inside its package; an app binding's spread is never followed. Seed 1337.
import fs from "node:fs";
import path from "node:path";
import { tempDir } from "@keel/tooling/test-tmp";
import fc from "fast-check";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { routeLiterals } from "../src/routeLiterals.ts";
import type { SourceFile } from "../src/types/SourceFile.ts";
import type { Topology } from "../src/types/Topology.ts";

const PKG = "@keel/std-frag";
const M = "modules/m/routes.ts";
const C = `${PKG}/contract`;
const full = { file: C, layout: null, guard: null, actions: [], params: false, search: false };
const topology: Topology = { web: { modules: ["m", "frag"], adapter: "node" } };
let root = "";

beforeEach(() => {
  root = tempDir(".tmp-fragment-", import.meta.dirname);
});
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

function put(rel: string, text: string): void {
  const at = path.join(root, rel);
  fs.mkdirSync(path.dirname(at), { recursive: true });
  fs.writeFileSync(at, text);
}

const contractOf = (entries: string): string =>
  `import { contract } from "@keel/router/contract";\nexport const frag = contract("frag", { ${entries} });\n`;
const bindingOf = (binding: string, pre = ""): string =>
  `import { manifest } from "@keel/router";\nimport { frag } from "./contract.ts";\n${pre}\nexport const routes = manifest(frag, { ${binding} });\n`;

/** `@keel/std-frag` (module id `frag`) with `./contract` and `./routes` exports and those files' texts. */
function pkg(contract: string, routes: string, exports: Record<string, unknown> = {}): void {
  put(
    `node_modules/${PKG}/package.json`,
    JSON.stringify({ exports: { "./contract": "./src/contract.ts", "./routes": "./src/routes.ts", ...exports } }),
  );
  put(
    `node_modules/${PKG}/module.ts`,
    'export default { id: "frag", deps: [], capabilities: [], public: { exports: [] } };\n',
  );
  put(`node_modules/${PKG}/src/contract.ts`, contract);
  put(`node_modules/${PKG}/src/routes.ts`, routes);
}

/** The app's `modules/m/` with the package in `deps`, a contract and a binding whose text is `binding`. */
function app(binding = `"m.home": { component: Home }`, pre = ""): SourceFile[] {
  const files: SourceFile[] = [
    {
      path: "modules/m/module.ts",
      source: `export default module({ id: "m", deps: ["${PKG}"], capabilities: [], public: { exports: [] } });\n`,
    },
    {
      path: "modules/m/m.contract.ts",
      source: `import { contract } from "@keel/router/contract";\nexport const m = contract("m", { "m.home": { path: "/" } });\n`,
    },
    {
      path: M,
      source: `import { manifest } from "@keel/router";\nimport { m } from "./m.contract.ts";\n${pre}\nexport const routes = manifest(m, { ${binding} });\n`,
    },
  ];
  for (const f of files) put(f.path, f.source);
  return files;
}

describe("routeLiterals over a placed stdlib module", () => {
  it("reads its contract and binding, a guard imported beside a same-named folder included", () => {
    put(`node_modules/${PKG}/src/routes/keep.ts`, "export const k = 1;\n");
    put(
      `node_modules/${PKG}/src/routes/reader.guard.ts`,
      `export const reader = guard({ redirect: "frag.in" }, fn);\n`,
    );
    pkg(
      contractOf(
        `"frag.in": { path: "/in" }, "frag.list": { path: "/list", search: S }, "frag.add": { method: "POST", path: "/list", output: O }`,
      ),
      bindingOf(
        `"frag.in": { component: V }, "frag.list": { component: V, guard: reader }, "frag.add": { action: add }`,
        `import { reader } from "./routes/reader.guard.ts";\nimport { k } from "./routes";`,
      ),
    );
    const r = routeLiterals(app(), { root, topology });
    expect(r).toEqual({
      routes: {
        "m.home": { ...full, file: "modules/m/m.contract.ts", path: "/" },
        "frag.in": { ...full, path: "/in" },
        "frag.list": { ...full, path: "/list", guard: "frag.in", search: true },
        "frag.add": { ...full, path: "/list", api: true, method: "POST", actions: ["POST"] },
      },
      closed: true,
      unread: [],
    });
  });

  it("reads a contract the binding imports by the package's own `./contract` specifier", () => {
    pkg(
      contractOf(`"frag.a": { path: "/a" }`),
      `import { manifest } from "@keel/router";\nimport { frag } from "${C}";\nexport const routes = manifest(frag, { "frag.a": { component: V } });\n`,
    );
    expect(routeLiterals(app(), { root, topology })?.routes["frag.a"]).toEqual({ ...full, path: "/a" });
  });

  it("reads nothing of a package no deployable places", () => {
    pkg(contractOf(`"frag.a": { path: "/a" }`), bindingOf(`"frag.a": { component: V }`));
    const r = routeLiterals(app(), { root, topology: { web: { modules: ["m"], adapter: "node" } } });
    expect(Object.keys(r?.routes ?? {})).toEqual(["m.home"]);
  });

  it("opens on an app binding's spread of the package's routes, naming it, and reads nothing from the package", () => {
    pkg(contractOf(`"frag.a": { path: "/a" }`), bindingOf(`"frag.a": { component: V }`));
    const files = app(`"m.home": { component: Home }, ...x.routes`, `import { routes as x } from "${PKG}/routes";`);
    const r = routeLiterals(files, { root, topology: { web: { modules: ["m"], adapter: "node" } } });
    expect(r?.closed).toBe(false);
    expect(r?.unread).toEqual(["m.home", `${M} ...x.routes`]);
    expect(Object.keys(r?.routes ?? {})).toEqual(["m.home"]);
  });

  it("opens on a spread inside the package's binding, naming it by specifier", () => {
    pkg(contractOf(`"frag.a": { path: "/a" }`), bindingOf("...more"));
    const r = routeLiterals(app(), { root, topology });
    expect(r?.closed).toBe(false);
    expect(r?.unread).toEqual([`${PKG}/routes ...more`]);
  });

  it("unreads a guard the package's binding imports from outside its package", () => {
    put("outside.ts", `export const reader = guard({ redirect: "frag.a" }, fn);\n`);
    pkg(
      contractOf(`"frag.a": { path: "/a" }`),
      bindingOf(`"frag.a": { component: V, guard: reader }`, `import { reader } from "../../../../outside.ts";`),
    );
    const r = routeLiterals(app(), { root, topology });
    expect(r?.routes["frag.a"]).toEqual({
      file: C,
      path: "/a",
      layout: null,
      actions: [],
      params: false,
      search: false,
    });
    expect(r?.unread).toEqual(["frag.a guard"]);
  });

  it("opens on a contract its binding imports from outside the package, naming it", () => {
    put("outside/contract.ts", contractOf(`"frag.out": { path: "/out" }`));
    pkg(
      contractOf(`"frag.a": { path: "/a" }`),
      bindingOf(`"frag.out": { component: V }`).replace("./contract.ts", "../../../../outside/contract.ts"),
    );
    const r = routeLiterals(app(), { root, topology });
    expect(r?.unread).toEqual([`${PKG}/routes contract`]);
    expect(r?.routes["frag.out"]).toBeUndefined();
  });

  for (const target of ["./../../../outside/routes.ts", "../../../outside/routes.ts", "./node_modules/x/routes.ts"])
    it(`places nothing for a \`./routes\` target that breaks Node's target rule: ${target}`, () => {
      put("outside/routes.ts", bindingOf(`"frag.a": { component: V }`));
      pkg(contractOf(`"frag.a": { path: "/a" }`), "", { "./routes": target });
      expect(Object.keys(routeLiterals(app(), { root, topology })?.routes ?? {})).toEqual(["m.home"]);
    });

  it("reads the file Node's conditions pick from a `module` and `default` map", () => {
    pkg(contractOf(`"frag.a": { path: "/a" }`), "", { "./routes": { module: "./esm.ts", default: "./plain.ts" } });
    put(
      `node_modules/${PKG}/esm.ts`,
      bindingOf(`"frag.a": { component: V, POST: p }`).replace("./contract.ts", "./src/contract.ts"),
    );
    put(
      `node_modules/${PKG}/plain.ts`,
      bindingOf(`"frag.a": { component: V }`).replace("./contract.ts", "./src/contract.ts"),
    );
    expect(routeLiterals(app(), { root, topology })?.routes["frag.a"]?.actions).toEqual([]);
  });

  it("reads back exactly the fields of any generated stdlib contract and binding", () => {
    const verbs = ["DELETE", "PATCH", "POST", "PUT"] as const;
    const word = fc.stringMatching(/^[a-z]{1,6}$/);
    const entry = fc.record({ path: fc.option(word, { nil: undefined }), actions: fc.subarray([...verbs]) });
    fc.assert(
      fc.property(fc.uniqueArray(fc.tuple(word, entry), { maxLength: 6, selector: (t) => t[0] }), (table) => {
        const entries = table
          .map(([w, e]) => `"frag.${w}": ${e.path === undefined ? "{ layout: true }" : `{ path: "/${e.path}" }`}`)
          .join(",\n");
        const binding = table
          .map(([w, e]) => `"frag.${w}": { component: V${e.actions.map((v) => `, ${v}: fn`).join("")} }`)
          .join(",\n");
        pkg(contractOf(entries), bindingOf(binding));
        const r = routeLiterals(app(), { root, topology });
        const expected = Object.fromEntries([
          ["m.home", { ...full, file: "modules/m/m.contract.ts", path: "/" }],
          ...table.map(([w, e]) => [
            `frag.${w}`,
            {
              ...full,
              path: e.path === undefined ? null : `/${e.path}`,
              actions: e.path === undefined ? [] : verbs.filter((v) => e.actions.includes(v)),
            },
          ]),
        ]);
        expect(r).toEqual({ routes: expected, closed: true, unread: [] });
      }),
      { seed: 1337, numRuns: 50 },
    );
  });
});
