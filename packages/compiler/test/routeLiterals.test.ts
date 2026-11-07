// rfc:0059 (backlog 0155): routeLiterals reads routes.ts statically; projectManifests selects what vite build evaluates.
// Seed 1337
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { artifactHashes } from "../src/artifactHashes.ts";
import { projectManifests } from "../src/internal/projectManifests.ts";
import { routeLiterals } from "../src/routeLiterals.ts";
import type { SourceFile } from "../src/types/SourceFile.ts";
import type { Topology } from "../src/types/Topology.ts";

const M = "modules/m/routes.ts";
const manifestSrc = (body: string, pre = ""): string => `${pre}\nexport const routes = manifest({ ${body} });\n`;
const read = (body: string, pre = "", extra: readonly SourceFile[] = []) =>
  routeLiterals([{ path: M, source: manifestSrc(body, pre) }, ...extra]);

describe("routeLiterals", () => {
  it("returns undefined without a modules/<m>/routes.ts and hashes routes.json as a string", () => {
    const files: SourceFile[] = [{ path: "modules/m/other.ts", source: "export const x = 1;\n" }];
    expect(routeLiterals(files)).toBeUndefined();
    expect(typeof artifactHashes(files)["routes.json"]).toBe("string");
  });

  it("reads a literal manifest into exact route fields", () => {
    const r = read(
      `"m.home": { path: "/home", component: X }, "m.shell": { component: S },
       "m.edit": { path: \`/e/:id\`, layout: "m.shell", actions: { POST: a, GET: g, PUT: undefined }, params: P, search: undefined }`,
    );
    expect(r).toEqual({
      routes: {
        "m.home": { path: "/home", layout: null, guard: null, actions: [], params: false, search: false },
        "m.shell": { path: null, layout: null, guard: null, actions: [], params: false, search: false },
        "m.edit": { path: "/e/:id", layout: "m.shell", guard: null, actions: ["POST"], params: true, search: false },
      },
      closed: true,
      unread: [],
    });
  });

  it("orders action verbs as DELETE, PATCH, POST, PUT", () => {
    const r = read(`"m.a": { actions: { PUT: p, POST: q, PATCH: r, DELETE: s } }`);
    expect(r?.routes["m.a"]?.actions).toEqual(["DELETE", "PATCH", "POST", "PUT"]);
  });

  describe("guard", () => {
    const route = `"m.a": { guard: g }`;
    it("reads a locally declared guard redirect", () => {
      const r = read(route, `const g = guard({ redirect: "m.home" }, fn);`);
      expect(r?.routes["m.a"]?.guard).toBe("m.home");
      expect(r?.unread).toEqual([]);
    });

    it("reads an imported guard from a sibling file", () => {
      const r = read(`"m.a": { guard: editable }`, `import { editable } from "./editable.guard.ts";`, [
        { path: "modules/m/editable.guard.ts", source: `export const editable = guard({ redirect: "m.login" }, fn);` },
      ]);
      expect(r?.routes["m.a"]?.guard).toBe("m.login");
      expect(r?.unread).toEqual([]);
    });

    it("follows an aliased import to the exported name", () => {
      const r = read(`"m.a": { guard: e }`, `import { editable as e } from "./x.guard.ts";`, [
        { path: "modules/m/x.guard.ts", source: `export const editable = guard({ redirect: "m.x" }, fn);` },
      ]);
      expect(r?.routes["m.a"]?.guard).toBe("m.x");
    });

    it("resolves a parent-directory import", () => {
      const r = read(`"m.a": { guard: g }`, `import { g } from "../other/g.ts";`, [
        { path: "modules/other/g.ts", source: `export const g = guard({ redirect: "o.home" }, fn);` },
      ]);
      expect(r?.routes["m.a"]?.guard).toBe("o.home");
    });

    it("resolves an extensionless specifier to a .ts file", () => {
      const r = read(`"m.a": { guard: g }`, `import { g } from "./g.guard";`, [
        { path: "modules/m/g.guard.ts", source: `export const g = guard({ redirect: "m.e" }, fn);` },
      ]);
      expect(r?.routes["m.a"]?.guard).toBe("m.e");
    });

    const unresolved: readonly (readonly [string, string, readonly SourceFile[]])[] = [
      ["a package import", `import { g } from "some-pkg";`, []],
      ["a missing file", `import { g } from "./missing.ts";`, []],
      ["a call that is not guard(...)", `const g = other({ redirect: "m.home" }, fn);`, []],
      ["a redirect that is not a literal", "const g = guard({ redirect: target }, fn);", []],
      ["an unbound identifier", "", []],
    ];
    for (const [name, pre, extra] of unresolved)
      it(`names the guard unread for ${name}`, () => {
        const r = read(route, pre, extra);
        expect(r?.unread).toEqual(["m.a guard"]);
        expect(r?.routes["m.a"]).not.toHaveProperty("guard");
      });

    it("reads guard: null as no guard", () => {
      expect(read(`"m.a": { guard: null }`)?.routes["m.a"]?.guard).toBeNull();
    });
  });

  describe("non-literal parts", () => {
    const cases: readonly (readonly [string, string, string])[] = [
      ["a concatenated path", `path: base + "x"`, "path"],
      ["a template path with an expression", "path: `/a/${x}`", "path"],
      ["a shorthand path", "path", "path"],
      ["params: null", "params: null", "params"],
    ];
    for (const [name, prop, field] of cases)
      it(`names ${field} unread for ${name}`, () => {
        const r = read(`"m.a": { ${prop} }`);
        expect(r?.unread).toEqual([`m.a ${field}`]);
        expect(r?.routes["m.a"]).not.toHaveProperty(field);
        expect(r?.closed).toBe(true);
      });

    it("unreads a route whose value is not an object", () => {
      const r = read(`"m.a": makeRoute()`);
      expect(r?.routes["m.a"]).toEqual({});
      expect(r?.unread).toEqual(["m.a"]);
    });

    it("unreads a route object containing a spread", () => {
      const r = read(`"m.a": { ...base, path: "/a" }`);
      expect(r?.routes["m.a"]).toEqual({});
      expect(r?.unread).toEqual(["m.a"]);
    });
  });

  describe("open id sets", () => {
    for (const [name, part, file] of [
      ["a spread", "...more", `${M} ids`],
      ["a computed key", `[k]: { path: "/k" }`, `${M} ids`],
    ] as const)
      it(`closes false on ${name} and unreads routes read before it only`, () => {
        const r = read(`"m.a": { path: "/a" }, ${part}, "m.b": { path: "/b" }`);
        expect(r?.closed).toBe(false);
        expect(r?.unread).toEqual(["m.a", file]);
        expect(r?.routes["m.a"]).toEqual({});
        expect(r?.routes["m.b"]).toEqual({
          path: "/b",
          layout: null,
          guard: null,
          actions: [],
          params: false,
          search: false,
        });
      });

    it("opens on a manifest that does not parse", () => {
      const r = routeLiterals([{ path: M, source: "export const routes = manifest({ ;;" }]);
      expect(r).toEqual({ routes: {}, closed: false, unread: [M] });
    });

    it("opens on a manifest without routes = manifest({...})", () => {
      const r = routeLiterals([{ path: M, source: "export const routes = other({});" }]);
      expect(r).toEqual({ routes: {}, closed: false, unread: [M] });
    });
  });

  describe("selection", () => {
    const route = (id: string, p: string): string => manifestSrc(`"${id}": { path: "${p}" }`);
    const files: SourceFile[] = [
      { path: "modules/a/routes.ts", source: route("a.x", "/a") },
      { path: "modules/b/routes.ts", source: route("b.x", "/b") },
    ];

    it("reads only the client deployable's modules", () => {
      const topology: Topology = {
        web: { modules: ["b"], adapter: "client" },
        api: { modules: ["a"], adapter: "node" },
      };
      expect(Object.keys(routeLiterals(files, { topology })?.routes ?? {})).toEqual(["b.x"]);
    });

    it("reads every manifest for an all-node topology or none", () => {
      const topology: Topology = { api: { modules: ["a"], adapter: "node" } };
      expect(Object.keys(routeLiterals(files, { topology })?.routes ?? {})).toEqual(["a.x", "b.x"]);
      expect(Object.keys(routeLiterals(files)?.routes ?? {})).toEqual(["a.x", "b.x"]);
    });

    it("lets a later file in module id order override a duplicate id", () => {
      const dup: SourceFile[] = [
        { path: "modules/b/routes.ts", source: route("d.x", "/b") },
        { path: "modules/a/routes.ts", source: route("d.x", "/a") },
      ];
      expect(routeLiterals(dup)?.routes["d.x"]?.path).toBe("/b");
    });

    it("hashes routes.json as null only when a selected manifest exists", () => {
      expect(artifactHashes(files)["routes.json"]).toBeNull();
      const topology: Topology = { web: { modules: ["c"], adapter: "client" } };
      expect(typeof artifactHashes(files, { topology })["routes.json"]).toBe("string");
    });
  });

  it("orders projectManifests by module id", () => {
    const paths = ["modules/a-b/routes.ts", "modules/a/routes.ts"];
    expect(projectManifests(undefined, paths)).toEqual(["modules/a/routes.ts", "modules/a-b/routes.ts"]);
  });

  it("reads back exactly the fields of any generated literal table", () => {
    const verbs = ["DELETE", "PATCH", "POST", "PUT"] as const;
    const word = fc.stringMatching(/^[a-z]{1,6}$/);
    const entry = fc.record({
      path: fc.option(word, { nil: undefined }),
      layout: fc.option(word, { nil: undefined }),
      actions: fc.subarray([...verbs]),
    });
    fc.assert(
      fc.property(fc.uniqueArray(fc.tuple(word, entry), { maxLength: 8, selector: (t) => t[0] }), (table) => {
        const body = table
          .map(([w, e]) => {
            const parts: string[] = [];
            if (e.path !== undefined) parts.push(`path: "/${e.path}"`);
            if (e.layout !== undefined) parts.push(`layout: "m.${e.layout}"`);
            if (e.actions.length > 0) parts.push(`actions: { ${e.actions.map((v) => `${v}: fn`).join(", ")} }`);
            return `"m.${w}": { ${parts.join(", ")} }`;
          })
          .join(",\n");
        const r = read(body);
        const expected = Object.fromEntries(
          table.map(([w, e]) => [
            `m.${w}`,
            {
              path: e.path === undefined ? null : `/${e.path}`,
              layout: e.layout === undefined ? null : `m.${e.layout}`,
              guard: null,
              actions: verbs.filter((v) => e.actions.includes(v)),
              params: false,
              search: false,
            },
          ]),
        );
        expect(r).toEqual({ routes: expected, closed: true, unread: [] });
      }),
      { seed: 1337, numRuns: 100 },
    );
  });
});
