// k.compiler Artifacts: routeLiterals reads a module's contract and binding literals statically (ids, path, method,
// params and search or query presence from the contract; layout, verbs and guard redirect from the binding);
// projectManifests selects what vite build evaluates. Seed 1337.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { artifactHashes } from "../src/artifactHashes.ts";
import { projectManifests } from "../src/internal/projectManifests.ts";
import { routeLiterals } from "../src/routeLiterals.ts";
import type { SourceFile } from "../src/types/SourceFile.ts";
import type { Topology } from "../src/types/Topology.ts";

const M = "modules/m/routes.ts";
const C = "modules/m/m.contract.ts";
const contractSrc = (entries: string, pre = ""): string =>
  `import { contract } from "@keel/router/contract";\n${pre}\nexport const m = contract("m", { ${entries} });\n`;
const bindingSrc = (binding: string, pre = ""): string =>
  `import { manifest } from "@keel/router";\nimport { m } from "./m.contract.ts";\n${pre}\nexport const routes = manifest(m, { ${binding} });\n`;
const files = (entries: string, binding: string, pre = "", cpre = ""): SourceFile[] => [
  { path: C, source: contractSrc(entries, cpre) },
  { path: M, source: bindingSrc(binding, pre) },
];
const read = (entries: string, binding: string, pre = "", extra: readonly SourceFile[] = [], cpre = "") =>
  routeLiterals([...files(entries, binding, pre, cpre), ...extra]);
const page = { file: C, layout: null, guard: null, actions: [], params: false, search: false };

describe("routeLiterals", () => {
  it("returns undefined without a modules/<m>/routes.ts and hashes routes.json as a string", () => {
    const only: SourceFile[] = [{ path: C, source: contractSrc(`"m.a": { path: "/a" }`) }];
    expect(routeLiterals(only)).toBeUndefined();
    expect(typeof artifactHashes(only)["routes.json"]).toBe("string");
  });

  it("reads each kind of entry into exact route fields", () => {
    const r = read(
      `"m.shell": { layout: true },
       "m.home": { path: "/home", search: S },
       "m.edit": { path: \`/e/:id\`, params: P, search: undefined },
       "m.box": { method: "GET", path: "/api/box", query: Q, output: O },
       "m.add": { method: "POST", path: "/api/box", body: B, output: O }`,
      `"m.shell": { component: Shell },
       "m.home": { component: Home, layout: "m.shell" },
       "m.edit": { component: Edit, layout: "m.shell", POST: save, PUT: undefined },
       "m.box": { loader: box },
       "m.add": { action: add }`,
    );
    expect(r).toEqual({
      routes: {
        "m.shell": { ...page, path: null },
        "m.home": { ...page, path: "/home", layout: "m.shell", search: true },
        "m.edit": { ...page, path: "/e/:id", layout: "m.shell", actions: ["POST"], params: true },
        "m.box": { ...page, path: "/api/box", api: true, method: "GET", search: true },
        "m.add": { ...page, path: "/api/box", api: true, method: "POST", actions: ["POST"] },
      },
      closed: true,
      unread: [],
    });
  });

  it("orders a page's verbs as DELETE, PATCH, POST, PUT and gives a layout none", () => {
    const r = read(
      `"m.a": { path: "/a" }, "m.l": { layout: true }`,
      `"m.a": { component: A, PUT: p, POST: q, PATCH: r, DELETE: s }, "m.l": { component: L, POST: q }`,
    );
    expect(r?.routes["m.a"]?.actions).toEqual(["DELETE", "PATCH", "POST", "PUT"]);
    expect(r?.routes["m.l"]?.actions).toEqual([]);
  });

  it("reads the contract through a const alias and the binding through a const", () => {
    const r = routeLiterals([
      { path: C, source: contractSrc(`"m.a": { path: "/a" }`) },
      {
        path: M,
        source: `import { manifest } from "@keel/router";\nimport { m as c } from "./m.contract.ts";\nconst k = c;\nconst b = { "m.a": { component: A, POST: p } };\nconst r = manifest(k, b);\nexport const routes = r;\n`,
      },
    ]);
    expect(r?.routes["m.a"]).toEqual({ ...page, path: "/a", actions: ["POST"] });
    expect(r?.unread).toEqual([]);
  });

  it("ignores binding keys the contract lacks (E1515 at evaluation)", () => {
    const r = read(`"m.a": { path: "/a" }`, `"m.a": { component: A }, "m.z": { component: Z }`);
    expect(Object.keys(r?.routes ?? {})).toEqual(["m.a"]);
    expect(r?.unread).toEqual([]);
  });

  it("reads literal computed keys, and follows no name or spread in a contract, a const object literal included", () => {
    const base = { path: "modules/m/base.ts", source: 'const on = "/b";\nexport const base = { path: on };\n' };
    const r = read(
      `"m.a": e, ["m.b"]: { ["path"]: "/c" }, "m.c": { method: verb, path: "/x", output: O }, "m.d": { ...base }`,
      `"m.a": { component: A }, "m.b": { component: B }, "m.c": { action: x }, "m.d": { component: D }`,
      "",
      [base],
      `import { base } from "./base";\nconst verb = "PUT";\nconst e = { path: "/e" };`,
    );
    expect([r?.routes["m.a"]?.path, r?.routes["m.b"]?.path, r?.routes["m.c"]?.method, r?.routes["m.d"]?.path]).toEqual([
      undefined,
      "/c",
      undefined,
      undefined,
    ]);
    expect(r?.unread).toEqual(["m.a e", "m.c method", "m.d ...base", "m.c actions"]);
    expect(r?.closed).toBe(false);
  });

  it("names an entry unread by its source when a spread, a key or the entry is not written out", () => {
    for (const [body, name] of [
      [`"m.a": { ...f() }`, "m.a ...f()"],
      [`"m.a": { [k]: "/a" }`, `m.a [k]: "/a"`],
      [`"m.a": make()`, "m.a make()"],
      [`"m.a": { ...gone }`, "m.a ...gone"],
    ] as const)
      expect(read(body, `"m.a": { component: A }`)?.unread).toEqual([name]);
    expect(read(`"m.a": { path: "/a" }`, `"m.a": make()`)?.unread).toEqual(["m.a"]);
  });

  it("reads a path only as a literal written in place, never through a const, a let, a var or an import", () => {
    const flag = { path: "modules/m/flag.ts", source: 'export const p = "/a";' };
    for (const pre of ['const p = "/x";', 'let p = "/x";\np = "/y";', 'var p = "/x";', 'import { p } from "./flag";']) {
      const r = read(`"m.a": { path: p }`, `"m.a": { component: A }`, "", [flag], pre);
      expect([r?.routes["m.a"]?.path, r?.unread, r?.closed], pre).toEqual([undefined, ["m.a path"], false]);
    }
  });

  describe("guard", () => {
    const entries = `"m.a": { path: "/a" }`;
    const bound = `"m.a": { component: A, guard: g }`;
    it("reads a guard redirect declared here or imported from a sibling or parent file", () => {
      expect(read(entries, bound, `const g = guard({ redirect: "m.home" }, fn);`)?.routes["m.a"]?.guard).toBe("m.home");
      const sibling = read(entries, bound, `import { e as g } from "./e.guard";`, [
        { path: "modules/m/e.guard.ts", source: `export const e = guard({ redirect: "m.login" }, fn);` },
      ]);
      expect([sibling?.routes["m.a"]?.guard, sibling?.unread]).toEqual(["m.login", []]);
      const parent = read(entries, bound, `import { g } from "../other/g.ts";`, [
        { path: "modules/other/g.ts", source: `export const g = guard({ redirect: "o.home" }, fn);` },
      ]);
      expect(parent?.routes["m.a"]?.guard).toBe("o.home");
    });

    const unresolved: readonly (readonly [string, string])[] = [
      ["a package import", `import { g } from "some-pkg";`],
      ["a missing file", `import { g } from "./missing.ts";`],
      ["a call that is not guard(...)", `const g = other({ redirect: "m.home" }, fn);`],
      ["a redirect that is not a literal", "const g = guard({ redirect: target }, fn);"],
      ["a spread in its declaration", "const g = guard({ ...d }, fn);"],
      ["an unbound identifier", ""],
    ];
    for (const [name, pre] of unresolved)
      it(`names the guard unread for ${name}`, () => {
        const r = read(entries, bound, pre);
        expect(r?.unread).toEqual(["m.a guard"]);
        expect(r?.routes["m.a"]).not.toHaveProperty("guard");
      });

    it("reads a guard without redirect, or guard: null, as null", () => {
      expect(read(entries, bound, "const g = guard({}, fn);")?.routes["m.a"]?.guard).toBeNull();
      expect(read(entries, `"m.a": { component: A, guard: null }`)?.routes["m.a"]?.guard).toBeNull();
    });
  });

  describe("non-literal parts", () => {
    const cases: readonly (readonly [string, string, string])[] = [
      ["a concatenated path", `path: base + "x"`, "path"],
      ["a template path with an expression", "path: `/a/${x}`", "path"],
      ["a shorthand path", "path", "path"],
      ["params: null", `path: "/a", params: null`, "params"],
    ];
    for (const [name, prop, field] of cases)
      it(`names ${field} unread for ${name}`, () => {
        const r = read(`"m.a": { ${prop} }`, `"m.a": { component: A }`);
        expect(r?.unread).toEqual([`m.a ${field}`]);
        expect(r?.routes["m.a"]).not.toHaveProperty(field);
        expect(r?.closed).toBe(false);
      });

    it("names an API entry's method and actions unread when its method is not literal", () => {
      const r = read(`"m.a": { method: verb, path: "/a", output: O }`, `"m.a": { action: a }`);
      expect(r?.unread).toEqual(["m.a method", "m.a actions"]);
      expect(r?.routes["m.a"]).toMatchObject({ api: true, path: "/a" });
      expect(r?.routes["m.a"]).not.toHaveProperty("actions");
    });

    it("names a binding layout unread when it is not literal", () => {
      const r = read(`"m.a": { path: "/a" }`, `"m.a": { component: A, layout: shell }`);
      expect(r?.unread).toEqual(["m.a layout"]);
    });
  });

  describe("open id sets", () => {
    for (const [name, part, file] of [
      ["a contract spread", "...more", `${C} ...more`],
      ["a contract computed key", `[k]: { path: "/k" }`, `${C} ids`],
    ] as const)
      it(`closes false on ${name} and unreads that module's routes read before it`, () => {
        const r = read(
          `"m.a": { path: "/a" }, ${part}, "m.b": { path: "/b" }`,
          `"m.a": { component: A }, "m.b": { component: B }`,
        );
        expect(r?.closed).toBe(false);
        expect(r?.unread).toEqual(["m.a", file]);
        expect(r?.routes["m.a"]).toEqual({ file: C });
        expect(r?.routes["m.b"]).toEqual({ ...page, path: "/b" });
      });

    it("closes false on a binding spread and names its source text", () => {
      const r = read(
        `"m.a": { path: "/a" }, "m.b": { path: "/b" }`,
        `"m.a": { component: A, POST: p }, ...x.routes, "m.b": { component: B }`,
      );
      expect(r?.closed).toBe(false);
      expect(r?.unread).toEqual(["m.a", `${M} ...x.routes`]);
      expect(r?.routes["m.a"]).not.toHaveProperty("actions");
      expect(r?.routes["m.b"]).toEqual({ ...page, path: "/b" });
    });

    it("keeps another module's routes when one module opens", () => {
      const r = routeLiterals([
        ...files(`"m.a": { path: "/a" }`, `"m.a": { component: A }, ...more`),
        {
          path: "modules/n/n.contract.ts",
          source: `import { contract } from "@keel/router/contract";\nexport const n = contract("n", { "n.a": { path: "/n" } });\n`,
        },
        {
          path: "modules/n/routes.ts",
          source: `import { manifest } from "@keel/router";\nimport { n } from "./n.contract.ts";\nexport const routes = manifest(n, { "n.a": { component: A } });\n`,
        },
      ]);
      expect(r?.closed).toBe(false);
      expect(r?.routes["n.a"]).toEqual({ ...page, file: "modules/n/n.contract.ts", path: "/n" });
    });

    it("opens on a binding that does not parse, or without routes = manifest(contract, {...})", () => {
      for (const source of [
        "export const routes = manifest(m, { ;;",
        "export const routes = other({});",
        "export const routes = manifest({});",
      ])
        expect(routeLiterals([{ path: M, source }])).toEqual({ routes: {}, closed: false, unread: [M] });
    });

    it("opens on a contract it cannot read, naming it", () => {
      for (const extra of [[], [{ path: C, source: "export const m = make();\n" }]])
        expect(routeLiterals([{ path: M, source: bindingSrc(`"m.a": { component: A }`) }, ...extra])).toEqual({
          routes: {},
          closed: false,
          unread: [`${M} contract`],
        });
    });
  });

  describe("selection", () => {
    const module = (id: string, p: string): SourceFile[] => [
      {
        path: `modules/${id}/${id}.contract.ts`,
        source: `import { contract } from "@keel/router/contract";\nexport const c = contract("${id}", { "${id}.x": { path: "${p}" } });\n`,
      },
      {
        path: `modules/${id}/routes.ts`,
        source: `import { manifest } from "@keel/router";\nimport { c } from "./${id}.contract.ts";\nexport const routes = manifest(c, { "${id}.x": { component: X } });\n`,
      },
    ];
    const both = [...module("a", "/a"), ...module("b", "/b")];

    it("reads only the client deployable's modules", () => {
      const topology: Topology = {
        web: { modules: ["b"], adapter: "client" },
        api: { modules: ["a"], adapter: "node" },
      };
      expect(Object.keys(routeLiterals(both, { topology })?.routes ?? {})).toEqual(["b.x"]);
    });

    it("reads every binding for an all-node topology or none", () => {
      const topology: Topology = { api: { modules: ["a"], adapter: "node" } };
      expect(Object.keys(routeLiterals(both, { topology })?.routes ?? {})).toEqual(["a.x", "b.x"]);
      expect(Object.keys(routeLiterals(both)?.routes ?? {})).toEqual(["a.x", "b.x"]);
    });

    it("hashes routes.json as null only when a selected binding exists", () => {
      expect(artifactHashes(both)["routes.json"]).toBeNull();
      const topology: Topology = { web: { modules: ["c"], adapter: "client" } };
      expect(typeof artifactHashes(both, { topology })["routes.json"]).toBe("string");
    });
  });

  it("orders projectManifests by module id", () => {
    const paths = ["modules/a-b/routes.ts", "modules/a/routes.ts"];
    expect(projectManifests(undefined, paths)).toEqual(["modules/a/routes.ts", "modules/a-b/routes.ts"]);
  });

  it("reads back exactly the fields of any generated literal contract and binding", () => {
    const verbs = ["DELETE", "PATCH", "POST", "PUT"] as const;
    const methods = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
    const word = fc.stringMatching(/^[a-z]{1,6}$/);
    const entry = fc.oneof(
      fc.record({
        kind: fc.constant("page" as const),
        path: word,
        layout: fc.option(word, { nil: undefined }),
        actions: fc.subarray([...verbs]),
      }),
      fc.record({ kind: fc.constant("layout" as const) }),
      fc.record({ kind: fc.constant("api" as const), path: word, method: fc.constantFrom(...methods) }),
    );
    fc.assert(
      fc.property(fc.uniqueArray(fc.tuple(word, entry), { maxLength: 8, selector: (t) => t[0] }), (table) => {
        const entries = table
          .map(([w, e]) =>
            e.kind === "layout"
              ? `"m.${w}": { layout: true }`
              : e.kind === "api"
                ? `"m.${w}": { method: "${e.method}", path: "/${e.path}", output: O }`
                : `"m.${w}": { path: "/${e.path}" }`,
          )
          .join(",\n");
        const binding = table
          .map(([w, e]) =>
            e.kind === "api"
              ? `"m.${w}": { ${e.method === "GET" ? "loader" : "action"}: h }`
              : `"m.${w}": { component: V${e.kind === "page" && e.layout !== undefined ? `, layout: "m.${e.layout}"` : ""}${e.kind === "page" ? e.actions.map((v) => `, ${v}: fn`).join("") : ""} }`,
          )
          .join(",\n");
        const expected = Object.fromEntries(
          table.map(([w, e]) => [
            `m.${w}`,
            e.kind === "layout"
              ? { ...page, path: null }
              : e.kind === "api"
                ? {
                    ...page,
                    path: `/${e.path}`,
                    api: true,
                    method: e.method,
                    actions: e.method === "GET" ? [] : [e.method],
                  }
                : {
                    ...page,
                    path: `/${e.path}`,
                    layout: e.layout === undefined ? null : `m.${e.layout}`,
                    actions: verbs.filter((v) => e.actions.includes(v)),
                  },
          ]),
        );
        expect(read(entries, binding)).toEqual({ routes: expected, closed: true, unread: [] });
      }),
      { seed: 1337, numRuns: 100 },
    );
  });
});
