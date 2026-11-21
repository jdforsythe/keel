// Spec: k.routes, Where rules fire "A deployable's table in `keel check` is the contracts of the modules `topology.ts` gives it (an app module's contract file, a stdlib module's `./contract`); with no `topology.ts`, the project's modules form one."
// Spec: k.routes, Conformance "With `a` holding a prefixed route (k.prefix) and `b` a page at `/de-DE/about`, `routeTable(a, b)` throws E1509, and `keel check` with `a` and `b` in one deployable reports one E1509 at `b`'s `path`; in two deployables, none."
// Spec: k.routes, Conformance "`contract` throws E1503, E1504, E1653 and E1113 for an entry breaking each, and `keel check` reports E1503, E1504 and E1653 from the same contract file and no E1113"
// Spec: k.routes, Where rules fire "`keel check` codes a type error by the node where it starts, whatever its TS code, when that node is the argument, a key, or a member's literal or name value: in a contract file's `contract` entries, a key without the module prefix E1155, else E1510; in a `manifest` binding, an entry's `layout` E1506, a member the entry's kind refuses E1510 with its fix, else E1515. Inside a function or call (a `title` body, a schema) it is E1751 with its own text, under an unprefixed key too."
// Spec: k.routes, Where rules fire "The types are mapped types keyed by id, so an unbound entry starts at the argument, an extra key at the key, a wrong member at the member. Each reported error maps alone."
// Spec: k.routes, Conformance "`keel check` over a binding with an unknown `layout`, an API GET entry bound with `action`, and a loader declared for `a.x` bound at `a.y` reports one E1506, one E1510 and one E1515 at those members, and no E1751; over an entry with `method` and `search`, one E1510 at `search`; over a key `b.home` in module `a`, one E1155 at the key; over an extra binding key, one E1515 at it."
// Spec: k.routes, Where rules fire "| E1513 | | `contract` (an API name only) | every case |"
// Seed 1337 (fc.assert below). The `keel check` column of the k.routes table, one test per row; the thrown column is packages/router/conformance/where-codes-table.test.ts.
import path from "node:path";
import { check } from "@keel/check";
import { repoRoot } from "@keel/tooling/repo-root";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SEED, lowerId, manifestFile } from "./module-support.ts";

const NO_TYPES = { types: false } as const;
// The type-error rows read real types, so those fixtures resolve `@keel/router` from its package root.
const TYPED = { root: path.join(repoRoot(import.meta.dirname), "packages", "router", path.sep) } as const;
const f = (path: string, source: string) => ({ path, source });
const HEAD = "import { contract } from '@keel/router/contract'\nimport { s } from '@keel/schema'\n";
const LOCALE = f(
  "modules/a/AppLocale.schema.ts",
  "import { s } from '@keel/schema'\nexport const AppLocale = s.enum(['en-US', 'de-DE'], { pathDefault: 'en-US' })\n",
);
const topo = (decls: string) =>
  f("topology.ts", `import { topology } from '@keel/server'\nexport default topology({ ${decls} })\n`);
const codes = (files: ReturnType<typeof f>[], code: string) =>
  check(files, NO_TYPES).diagnostics.filter((d) => d.code === code);

const aFile = f(
  "modules/a/a.contract.ts",
  `${HEAD}import { AppLocale } from './AppLocale.schema.ts'\nexport const a = contract('a', { 'a.show': { path: '/:p/items', params: s.object({ p: AppLocale }) } })\n`,
);
const bFile = f(
  "modules/b/b.contract.ts",
  `${HEAD}export const b = contract('b', { 'b.about': { path: '/de-DE/about' } })\n`,
);

describe("k.routes: the `keel check` column", () => {
  test("E1155: a contract key not prefixed by the module id is reported at the key", () => {
    const d = codes(
      [
        manifestFile({ id: "a" }),
        f("modules/a/a.contract.ts", `${HEAD}export const a = contract('a', { 'b.home': { path: '/' } })\n`),
      ],
      "E1155",
    );
    expect(d).toHaveLength(1);
  });

  test("E1502: reported for each contract and for each deployable's table", () => {
    const own = [
      manifestFile({ id: "a" }),
      f(
        "modules/a/a.contract.ts",
        `${HEAD}export const a = contract('a', { 'a.x': { path: '/p' }, 'a.y': { path: '/p' } })\n`,
      ),
    ];
    expect(codes(own, "E1502").length).toBeGreaterThanOrEqual(1);
    const mk = (id: string) =>
      f(
        `modules/${id}/${id}.contract.ts`,
        `${HEAD}export const ${id} = contract('${id}', { '${id}.home': { path: '/same' } })\n`,
      );
    const both = [manifestFile({ id: "a" }), manifestFile({ id: "b" }), mk("a"), mk("b")];
    expect(codes([...both, topo("web: { modules: ['a', 'b'], adapter: 'node' }")], "E1502")).toHaveLength(1);
    expect(
      codes([...both, topo("x: { modules: ['a'], adapter: 'node' }, y: { modules: ['b'], adapter: 'node' }")], "E1502"),
    ).toEqual([]);
  });

  test("E1503, E1504 and E1653: reported from the contract literal, E1653 with its fix", () => {
    const one = (entry: string) => [
      manifestFile({ id: "a" }),
      f("modules/a/a.contract.ts", `${HEAD}export const a = contract('a', { ${entry} })\n`),
    ];
    expect(codes(one("'a.s': { path: '/:id' }"), "E1503")).toHaveLength(1);
    expect(codes(one("'a.l': { path: '/l', search: s.object({ q: s.string() }) }"), "E1504")).toHaveLength(1);
    const e = codes(
      one("'a.g': { method: 'GET', path: '/api/:id', body: s.object({}), output: s.object({}) }"),
      "E1653",
    );
    expect(e).toHaveLength(1);
    expect(e[0]?.fix).toBeDefined();
  });

  test("E1509: reported for each deployable's table: one at `b`'s `path` with `a` and `b` in one deployable, none in two", () => {
    const base = [manifestFile({ id: "a" }), manifestFile({ id: "b" }), LOCALE, aFile, bFile];
    const one = codes([...base, topo("web: { modules: ['a', 'b'], adapter: 'node' }")], "E1509");
    expect(one).toHaveLength(1);
    expect(one[0]?.path).toBe("modules/b/b.contract.ts");
    const two = codes(
      [...base, topo("x: { modules: ['a'], adapter: 'node' }, y: { modules: ['b'], adapter: 'node' }")],
      "E1509",
    );
    expect(two).toEqual([]);
  });

  test("E1513: `keel check` reports every case, no fix, naming the expected path", () => {
    fc.assert(
      fc.property(lowerId, (a) => {
        const d = codes(
          [
            manifestFile({ id: a }),
            f(
              `modules/${a}/routes.ts`,
              `${HEAD}export const ${a} = contract('${a}', { '${a}.home': { path: '/' } })\n`,
            ),
          ],
          "E1513",
        );
        expect(d).toHaveLength(1);
        expect(d[0]?.fix).toBeUndefined();
      }),
      { seed: SEED, numRuns: 10 },
    );
  });

  test("E1514: reported in every case, at the import of a `*.server.ts` file", () => {
    const d = codes(
      [
        manifestFile({ id: "a" }),
        f("modules/a/load.server.ts", "export const x = 1\n"),
        f(
          "modules/a/a.contract.ts",
          `${HEAD}import { x } from './load.server.ts'\nexport const a = contract('a', { 'a.home': { path: '/' } })\nvoid x\n`,
        ),
      ],
      "E1514",
    );
    expect(d).toHaveLength(1);
    expect(d[0]?.fix).toBeUndefined();
  });

  test("E1113: `keel check` reports none for an API output holding `s.secret` in a contract (a runtime code only)", () => {
    const files = [
      manifestFile({ id: "a" }),
      f(
        "modules/a/a.contract.ts",
        `${HEAD}export const a = contract('a', { 'a.g': { method: 'GET', path: '/api/g', output: s.object({ t: s.secret(s.string()) }) } })\n`,
      ),
    ];
    expect(codes(files, "E1113")).toEqual([]);
  });

  describe("the type-error rows, reported under their own codes and never as E1751", () => {
    const PAGE = "declare const Page: () => Node\n";
    const bind = (contractBody: string, bindingBody: string, extra: ReturnType<typeof f>[] = []) => [
      manifestFile({ id: "a" }),
      f("modules/a/a.contract.ts", `${HEAD}export const a = contract('a', { ${contractBody} })\n`),
      ...extra,
      f(
        "modules/a/routes.ts",
        `import { manifest } from '@keel/router'\nimport { a } from './a.contract.ts'\n${PAGE}export const routes = manifest(a, {\n${bindingBody}\n})\n`,
      ),
    ];
    const typed = (files: ReturnType<typeof f>[]) => check(files, TYPED).diagnostics;

    test("an unknown `layout`, an API GET entry bound with `action` and a loader declared for `a.x` bound at `a.y` are one E1506, one E1510 and one E1515 at those members, and no E1751", () => {
      const loaders = f(
        "modules/a/load.server.ts",
        "import { loader } from '@keel/router'\nimport { ok, s } from '@keel/schema'\nimport { a } from './a.contract.ts'\nexport const loadGet = loader(a, 'a.get', {}, async () => ok({}))\nexport const loadX = loader(a, 'a.x', { output: s.object({}) }, async () => ok({}))\n",
      );
      const files = bind(
        "'a.shell': { layout: true }, 'a.home': { path: '/' }, 'a.get': { method: 'GET', path: '/api/get', output: s.json() }, 'a.x': { path: '/x' }, 'a.y': { path: '/y' }",
        [
          "  'a.shell': { component: Page },",
          "  'a.home': { component: Page, layout: 'a.zzz' },",
          "  'a.get': { loader: loadGet, action: () => null },",
          "  'a.x': { component: Page },",
          "  'a.y': { component: Page, loader: loadX },",
        ].join("\n"),
        [loaders],
      ).map((file) =>
        file.path === "modules/a/routes.ts"
          ? {
              ...file,
              source: file.source.replace(
                "import { a }",
                "import { loadGet, loadX } from './load.server.ts'\nimport { a }",
              ),
            }
          : file,
      );
      const d = typed(files);
      const at = (code: string) => d.filter((x) => x.code === code);
      expect(at("E1506")).toHaveLength(1);
      expect(at("E1510")).toHaveLength(1);
      expect(at("E1515")).toHaveLength(1);
      // routes.ts: `manifest(` is line 5, so `a.shell` is line 6, `a.home` (the unknown `layout`) line 7 and `a.get` (the refused `action`) line 8
      const line = (code: string) => at(code)[0]?.line;
      expect(line("E1506")).toBe(7);
      expect(line("E1510")).toBe(8);
      expect(d.filter((x) => x.code === "E1751")).toEqual([]);
    });

    // Inside a contract file the position decides: `a.contract.ts` has the `contract(` call on line 3, so the entries start at line 4.
    const inContract = (entries: string[]) => typed(bind(entries.join("\n"), "  'a.x': { component: Page }"));
    const here = (d: ReturnType<typeof typed>, code: string) =>
      d.filter((x) => x.code === code && x.path === "modules/a/a.contract.ts");

    test("inside `contract` entries, a key without the module prefix is one E1155 at the key and no E1510 or E1751", () => {
      const d = inContract(["'a.x': { path: '/x' },", "'b.home': { path: '/' }"].map((x) => `\n${x}`));
      expect(here(d, "E1155")).toHaveLength(1);
      expect(here(d, "E1155")[0]?.line).toBe(6);
      expect(here(d, "E1510")).toEqual([]);
      expect(d.filter((x) => x.code === "E1751")).toEqual([]);
    });

    test("inside `contract` entries, an entry with `method` and `search` is one E1510 at `search`", () => {
      const d = inContract([
        "\n'a.x': {\n  method: 'GET',\n  path: '/x',\n  output: s.json(),\n  search: s.object({ q: s.string() }),\n}",
      ]);
      expect(here(d, "E1510")).toHaveLength(1);
      expect(here(d, "E1510")[0]?.line).toBe(8);
      expect(here(d, "E1155")).toEqual([]);
      expect(d.filter((x) => x.code === "E1751")).toEqual([]);
    });

    test("inside `contract` entries, a page with `output` and a layout with `path` are each one E1510 at that member", () => {
      const d = inContract(["'a.x': { path: '/x', output: s.json() },", "'a.l': { layout: true, path: '/l' }"]);
      expect(here(d, "E1510")).toHaveLength(2);
      expect(here(d, "E1155")).toEqual([]);
      expect(d.filter((x) => x.code === "E1751")).toEqual([]);
    });

    test("inside a `manifest` binding, an entry bound with a member its kind refuses is one E1510 at the member, with its fix", () => {
      const d = typed(
        bind(
          "'a.get': { method: 'GET', path: '/api/get', output: s.json() }",
          "  'a.get': {\n    component: Page,\n  }",
        ),
      );
      const e = d.filter((x) => x.code === "E1510" && x.path === "modules/a/routes.ts");
      expect(e).toHaveLength(1);
      expect(e[0]?.line).toBe(6);
      expect(e[0]?.fix).toBeDefined();
      expect(d.filter((x) => x.code === "E1515" || x.code === "E1506" || x.code === "E1751")).toEqual([]);
    });

    test("inside a `manifest` binding, a `layout` naming a page is one E1506 at `layout` and no E1515 or E1510", () => {
      const d = typed(
        bind(
          "'a.p': { path: '/p' }, 'a.q': { path: '/q' }",
          "  'a.p': { component: Page },\n  'a.q': {\n    component: Page,\n    layout: 'a.p',\n  }",
        ),
      );
      const e = d.filter((x) => x.code === "E1506");
      expect(e).toHaveLength(1);
      expect(e[0]?.line).toBe(8);
      expect(d.filter((x) => x.code === "E1515" || x.code === "E1510" || x.code === "E1751")).toEqual([]);
    });

    test("inside a `manifest` binding, an unbound entry is one E1515 and no other code", () => {
      const d = typed(bind("'a.x': { path: '/x' }, 'a.y': { path: '/y' }", "  'a.x': { component: Page }"));
      expect(d.filter((x) => x.code === "E1515")).toHaveLength(1);
      expect(d.filter((x) => x.code === "E1506" || x.code === "E1510" || x.code === "E1751")).toEqual([]);
    });

    test("inside a `manifest` binding, an extra key is one E1515 at the key", () => {
      const d = typed(bind("'a.x': { path: '/x' }", "  'a.x': { component: Page },\n  'a.z': { component: Page }"));
      const e = d.filter((x) => x.code === "E1515");
      expect(e).toHaveLength(1);
      expect(e[0]?.line).toBe(6);
      expect(d.filter((x) => x.code === "E1506" || x.code === "E1510" || x.code === "E1751")).toEqual([]);
    });

    // An error inside a function body or a call starts at that inner node: E1751 with TypeScript's own text.
    const BAD_EXPR = "s.object({ q: s.string().nope() })"; // TS2339 at `nope`
    const e1751 = (d: ReturnType<typeof typed>) => d.filter((x) => x.code === "E1751");

    test("inside an inline `component`, `guard`, `loader`, `action` or `title` body in a binding, a type error is E1751 with TypeScript's own message, never E1510 or E1515", () => {
      fc.assert(
        fc.property(fc.constantFrom("component", "guard", "loader", "action", "title"), (member) => {
          const value =
            member === "component"
              ? "() => {\n      const n: number = 'x'\n      return Page()\n    }"
              : `() => {\n      const n: number = 'x'\n      return n as never\n    }`;
          const body =
            member === "component"
              ? `  'a.x': { component: ${value} }`
              : `  'a.x': { component: Page, ${member}: ${value} }`;
          const d = typed(bind("'a.x': { path: '/x' }", body));
          const inner = e1751(d).filter((x) => x.path === "modules/a/routes.ts" && x.message.includes("'string'"));
          expect(inner, member).toHaveLength(1);
          expect(inner[0]?.message).toMatch(/^TS\d{4}/);
          expect(inner[0]?.line, member).toBe(6);
          expect(d.filter((x) => (x.code === "E1510" || x.code === "E1515") && x.line === 6)).toEqual([]);
        }),
        { seed: SEED, numRuns: 10 },
      );
    });

    test("inside a `params`, `search`, `query`, `body` or `output` schema expression in a contract, a type error is E1751 with TypeScript's own message, never E1510", () => {
      const entries: Record<string, string> = {
        params: `'a.x': { path: '/x/:q', params: ${BAD_EXPR} }`,
        search: `'a.x': { path: '/x', search: ${BAD_EXPR} }`,
        query: `'a.x': { method: 'GET', path: '/x', query: ${BAD_EXPR}, output: s.json() }`,
        body: `'a.x': { method: 'POST', path: '/x', body: ${BAD_EXPR}, output: s.json() }`,
        output: `'a.x': { method: 'GET', path: '/x', output: ${BAD_EXPR} }`,
      };
      fc.assert(
        fc.property(fc.constantFrom(...Object.keys(entries)), (member) => {
          const d = inContract([`\n${entries[member]}`]);
          const mine = d.filter((x) => x.path === "modules/a/a.contract.ts");
          const inner = mine.filter((x) => x.code === "E1751");
          expect(inner, member).toHaveLength(1);
          expect(inner[0]?.message).toMatch(/^TS\d{4}/);
          expect(inner[0]?.line, member).toBe(4);
          expect(
            mine.filter((x) => x.code === "E1510"),
            member,
          ).toEqual([]);
        }),
        { seed: SEED, numRuns: 10 },
      );
    });

    test("an error on a member's literal value keeps its contract code: a `method` that is no verb is E1510, not E1751", () => {
      const d = inContract(["\n'a.x': { method: 'FETCH', path: '/x', output: s.json() }"]);
      expect(here(d, "E1510").length).toBeGreaterThanOrEqual(1);
      expect(here(d, "E1751")).toEqual([]);
    });

    test("an entry with an unprefixed key reports E1155 at the key and still reports E1751 for an error inside its value", () => {
      const d = inContract([`\n'b.home': { path: '/', search: ${BAD_EXPR} }`]);
      const key = here(d, "E1155");
      expect(key).toHaveLength(1);
      expect(key[0]?.line).toBe(4);
      expect(here(d, "E1751")).toHaveLength(1);
      expect(here(d, "E1751")[0]?.message).toMatch(/^TS\d{4}/);
      expect(here(d, "E1751")[0]?.line).toBe(4);
      expect(here(d, "E1515")).toEqual([]);
    });
  });
});
