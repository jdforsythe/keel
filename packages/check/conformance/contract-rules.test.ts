// Spec: k.contract, clause "A contract file importing a `.tsx` component, a `*.server.ts` file or `routes.ts` is one E1514; importing `*.schema.ts` files and `@keel/std-*` packages is none."
// Spec: k.contract, clause "`contract` in `modules/a/routes.ts`, or `contract('b', ...)` in `modules/a/a.contract.ts`, is one E1513 naming `modules/a/a.contract.ts`; called, `contract('b', ...)` throws none."
// k.contract, Rules "E1513 a `contract()` call outside `modules/<id>/<id>.contract.ts` or a package's `./contract`, a second one, an `id` not the folder's module id, an export not named `<id>`, a `routes.ts` binding another module's contract, `contract` reached but by a direct call of its import (an alias, a re-export), or an API id with a dotted name; `contract` throws the last alone; no fix, the message names the expected path"
// k.contract, Rules "E1510 an entry of no kind or with a member its kind refuses, or a binding member its entry refuses; a type error, thrown by `contract` or `manifest`; fix removes the member, none for an entry missing one"
// k.contract, Rules "E1514 a contract file importing anything but a `*.schema.ts` file or a package, at the import; no fix"
// k.contract, Rules "E1515 a binding missing an entry or an entry's required member, with a key the contract lacks, with a handler declared for another id or contract, with a plain loader on an `events: true` entry, or with an async generator loader on any other; a type error, `manifest` throws it naming the id; fix removes an extra key"
// E1513: `keel check` reports every case; `contract` throws only the API-name case (router where-codes-table).
// Seed 1337. Source-level rules of `check`; the type-error halves read real types, so those fixtures resolve `@keel/router` from its package root.
import path from "node:path";
import { check, reportedCodes } from "@keel/check";
import { repoRoot } from "@keel/tooling/repo-root";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SEED, codesOf, has, lowerId, manifestFile } from "./module-support.ts";

const ROUTER_ROOT = path.join(repoRoot(import.meta.dirname), "packages", "router", path.sep);
const TYPED = { root: ROUTER_ROOT } as const;
const NO_TYPES = { types: false } as const;
const f = (p: string, source: string) => ({ path: p, source });
const HEAD = "import { contract } from '@keel/router/contract'\n";

describe("E1513 contract placement", () => {
  test("`contract` in `modules/a/routes.ts` is one E1513 naming `modules/a/a.contract.ts`", () => {
    fc.assert(
      fc.property(lowerId, (a) => {
        const files = [
          manifestFile({ id: a }),
          f(`modules/${a}/routes.ts`, `${HEAD}export const ${a} = contract('${a}', { '${a}.home': { path: '/' } })\n`),
        ];
        const d = codesOf(files, "E1513");
        expect(d).toHaveLength(1);
        expect(String(d[0]?.message)).toContain(`modules/${a}/${a}.contract.ts`);
        expect(d[0]?.fix).toBeUndefined();
        const clean = [
          manifestFile({ id: a }),
          f(
            `modules/${a}/${a}.contract.ts`,
            `${HEAD}export const ${a} = contract('${a}', { '${a}.home': { path: '/' } })\n`,
          ),
        ];
        expect(has(clean, "E1513")).toBe(false);
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  test("`contract('b', ...)` in `modules/a/a.contract.ts` is one E1513 naming `modules/a/a.contract.ts`", () => {
    const files = [
      manifestFile({ id: "a" }),
      f("modules/a/a.contract.ts", `${HEAD}export const a = contract('b', { 'b.home': { path: '/' } })\n`),
    ];
    const d = codesOf(files, "E1513");
    expect(d).toHaveLength(1);
    expect(String(d[0]?.message)).toContain("modules/a/a.contract.ts");
  });

  test("a second `contract()` in the file, or an export not named `<id>`, is E1513", () => {
    const two = [
      manifestFile({ id: "a" }),
      f(
        "modules/a/a.contract.ts",
        `${HEAD}export const a = contract('a', { 'a.one': { path: '/' } })\nexport const again = contract('a', { 'a.two': { path: '/two' } })\n`,
      ),
    ];
    expect(has(two, "E1513")).toBe(true);
    const misnamed = [
      manifestFile({ id: "a" }),
      f("modules/a/a.contract.ts", `${HEAD}export const other = contract('a', { 'a.one': { path: '/' } })\n`),
    ];
    expect(has(misnamed, "E1513")).toBe(true);
  });

  test("an API id whose name after the module is not one lowerCamel segment is E1513", () => {
    const api = (id: string) => [
      manifestFile({ id: "a" }),
      f(
        "modules/a/a.contract.ts",
        `${HEAD}import { s } from '@keel/schema'\nexport const a = contract('a', { '${id}': { method: 'GET', path: '/x', output: s.json() } })\n`,
      ),
    ];
    expect(has(api("a.x.y"), "E1513")).toBe(true);
    expect(has(api("a.Big"), "E1513")).toBe(true);
    expect(has(api("a.box"), "E1513")).toBe(false);
  });

  test("a module's `routes.ts` binding another module's contract is E1513", () => {
    const files = [
      manifestFile({ id: "a", deps: ["b"] }),
      manifestFile({ id: "b" }),
      f("modules/b/b.contract.ts", `${HEAD}export const b = contract('b', { 'b.home': { path: '/' } })\n`),
      f(
        "modules/a/routes.ts",
        "import { manifest } from '@keel/router'\nimport { b } from '../b/b.contract.ts'\ndeclare const Page: () => Node\nexport const routes = manifest(b, { 'b.home': { component: Page } })\n",
      ),
    ];
    expect(has(files, "E1513")).toBe(true);
  });

  test("a package's `./contract` export may hold the `contract()` call", () => {
    const files = [
      f(
        "node_modules/@keel/std-x/contract.ts",
        `${HEAD}export const x = contract('x', { 'x.home': { path: '/x' } })\n`,
      ),
    ];
    expect(has(files, "E1513")).toBe(false);
  });
});

describe("E1514 contract imports", () => {
  const contractWith = (imp: string, extra: ReturnType<typeof f>[] = []) => [
    manifestFile({ id: "a" }),
    ...extra,
    f("modules/a/a.contract.ts", `${HEAD}${imp}\nexport const a = contract('a', { 'a.home': { path: '/' } })\n`),
  ];

  test("a contract file importing a `.tsx` component, a `*.server.ts` file or `routes.ts` is one E1514 at the import", () => {
    const cases: [string, ReturnType<typeof f>[]][] = [
      ["import View from './View.tsx'", [f("modules/a/View.tsx", "export default function View() { return null }\n")]],
      ["import { load } from './load.server.ts'", [f("modules/a/load.server.ts", "export const load = 1\n")]],
      ["import { routes } from './routes.ts'", [f("modules/a/routes.ts", "export const routes = 1\n")]],
    ];
    for (const [imp, extra] of cases) {
      const d = codesOf(contractWith(imp, extra), "E1514");
      expect(d, imp).toHaveLength(1);
      expect(d[0]?.path).toBe("modules/a/a.contract.ts");
      expect(d[0]?.fix).toBeUndefined();
    }
  });

  test("importing `*.schema.ts` files and `@keel/std-*` packages is none", () => {
    const files = contractWith(
      "import { Thing } from './Thing.schema.ts'\nimport { Tally } from '@keel/std-report'\nvoid [Thing, Tally]",
      [f("modules/a/Thing.schema.ts", "import { s } from '@keel/schema'\nexport const Thing = s.object({})\n")],
    );
    expect(has(files, "E1514")).toBe(false);
  });

  test("a schema file of a module in `deps` is allowed; each non-schema import among n imports is one E1514 apiece", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 4 }), (n) => {
        const names = Array.from({ length: n }, (_, i) => `helper${i}`);
        const extra = names.map((h) => f(`modules/a/${h}.ts`, `export const ${h} = 1\n`));
        const imports = names.map((h) => `import { ${h} } from './${h}.ts'`).join("\n");
        expect(codesOf(contractWith(imports, extra), "E1514")).toHaveLength(n);
      }),
      { seed: SEED, numRuns: 8 },
    );
  });
});

describe("E1510 and E1515 over a module's contract and binding", () => {
  const S = "import { s } from '@keel/schema'\n";
  const Page = "declare const Page: () => Node\n";
  const tree = (contractBody: string, bindingBody: string) => [
    manifestFile({ id: "a" }),
    f("modules/a/a.contract.ts", `${HEAD}${S}export const a = contract('a', { ${contractBody} })\n`),
    f(
      "modules/a/routes.ts",
      `import { manifest } from '@keel/router'\nimport { a } from './a.contract.ts'\n${Page}export const routes = manifest(a, { ${bindingBody} })\n`,
    ),
  ];

  test("E1510 an entry with `method` and `search`, with `layout: true` and `path`, or a page with `output` is reported in the contract file", () => {
    for (const entry of [
      "{ method: 'GET', path: '/x', output: s.json(), search: s.object({}) }",
      "{ layout: true, path: '/x' }",
      "{ path: '/x', output: s.json() }",
    ]) {
      const files = [
        manifestFile({ id: "a" }),
        f("modules/a/a.contract.ts", `${HEAD}${S}export const a = contract('a', { 'a.x': ${entry} })\n`),
      ];
      const d = check(files, TYPED).diagnostics.filter((x) => x.code === "E1510");
      expect(d.length, entry).toBeGreaterThanOrEqual(1);
      expect(d[0]?.path).toBe("modules/a/a.contract.ts");
    }
  });

  test("E1510 a binding member its entry refuses: a `component` on an API entry, an `action` on a page", () => {
    const apiTree = tree("'a.list': { method: 'GET', path: '/x', output: s.json() }", "'a.list': { component: Page }");
    expect(check(apiTree, TYPED).diagnostics.some((d) => d.code === "E1510")).toBe(true);
    const pageTree = tree("'a.home': { path: '/' }", "'a.home': { component: Page, action: () => null }");
    expect(check(pageTree, TYPED).diagnostics.some((d) => d.code === "E1510")).toBe(true);
  });

  test("E1515 a binding missing an entry is reported with no fix; a key the contract lacks is reported with a fix that removes it", () => {
    const missing = check(
      tree("'a.one': { path: '/' }, 'a.two': { path: '/two' }", "'a.one': { component: Page }"),
      TYPED,
    ).diagnostics.filter((d) => d.code === "E1515");
    expect(missing).toHaveLength(1);
    expect(String(missing[0]?.message)).toContain("a.two");
    expect(missing[0]?.fix).toBeUndefined();
    const extra = check(
      tree("'a.one': { path: '/' }", "'a.one': { component: Page }, 'a.extra': { component: Page }"),
      TYPED,
    ).diagnostics.filter((d) => d.code === "E1515");
    expect(extra).toHaveLength(1);
    expect(String(extra[0]?.message)).toContain("a.extra");
    expect(typeof extra[0]?.fix).toBe("string");
  });

  test("E1515 a complete binding is clean", () => {
    const files = tree(
      "'a.one': { path: '/' }, 'a.two': { path: '/two' }",
      "'a.one': { component: Page }, 'a.two': { component: Page }",
    );
    expect(check(files, TYPED).diagnostics.filter((d) => d.code === "E1515" || d.code === "E1510")).toEqual([]);
  });

  test("E1515 a handler declared for another id, and a plain loader on an `events: true` entry", () => {
    const handlers = (declared: string, boundAt: string) => [
      manifestFile({ id: "a" }),
      f(
        "modules/a/a.contract.ts",
        `${HEAD}export const a = contract('a', { 'a.x': { path: '/x' }, 'a.y': { path: '/y' } })\n`,
      ),
      f(
        "modules/a/loadX.server.ts",
        `import { loader } from '@keel/router'\nimport { ok, s } from '@keel/schema'\nimport { a } from './a.contract.ts'\nexport const loadX = loader(a, '${declared}', { output: s.object({}) }, async () => ok({}))\n`,
      ),
      f(
        "modules/a/routes.ts",
        `import { manifest } from '@keel/router'\nimport { a } from './a.contract.ts'\nimport { loadX } from './loadX.server.ts'\n${Page}export const routes = manifest(a, { 'a.x': { component: Page${boundAt === "a.x" ? ", loader: loadX" : ""} }, 'a.y': { component: Page${boundAt === "a.y" ? ", loader: loadX" : ""} } })\n`,
      ),
    ];
    expect(check(handlers("a.x", "a.x"), TYPED).diagnostics.some((d) => d.code === "E1515")).toBe(false);
    expect(check(handlers("a.x", "a.y"), TYPED).diagnostics.some((d) => d.code === "E1515")).toBe(true);
    const events = [
      manifestFile({ id: "a" }),
      f(
        "modules/a/a.contract.ts",
        `${HEAD}${S}export const a = contract('a', { 'a.ticks': { method: 'GET', path: '/t', output: s.json(), events: true } })\n`,
      ),
      f(
        "modules/a/ticks.server.ts",
        `import { loader } from '@keel/router'\nimport { ok } from '@keel/schema'\nimport { a } from './a.contract.ts'\nexport const ticks = loader(a, 'a.ticks', {}, async () => ok(1))\n`,
      ),
      f(
        "modules/a/routes.ts",
        `import { manifest } from '@keel/router'\nimport { a } from './a.contract.ts'\nimport { ticks } from './ticks.server.ts'\nexport const routes = manifest(a, { 'a.ticks': { loader: ticks } })\n`,
      ),
    ];
    expect(check(events, TYPED).diagnostics.some((d) => d.code === "E1515")).toBe(true);
  });

  test("E1503, E1504, E1653 read the contract's literal: a `:name` without `params`, a required page `search` field, a `body` on a GET entry", () => {
    const one = (entry: string) => [
      manifestFile({ id: "a" }),
      f("modules/a/a.contract.ts", `${HEAD}${S}export const a = contract('a', { 'a.x': ${entry} })\n`),
    ];
    expect(has(one("{ path: '/o/:id' }"), "E1503")).toBe(true);
    expect(has(one("{ path: '/o', search: s.object({ q: s.string() }) }"), "E1504")).toBe(true);
    expect(
      has(one("{ method: 'GET', path: '/o', query: s.object({ q: s.string() }), output: s.json() }"), "E1504"),
    ).toBe(false);
    expect(has(one("{ method: 'GET', path: '/o', body: s.object({}), output: s.json() }"), "E1653")).toBe(true);
    expect(has(one("{ method: 'POST', path: '/o', body: s.object({}), output: s.json() }"), "E1653")).toBe(false);
  });

  test("E1502 two entries on one path pattern, except API entries at different methods", () => {
    const two = (x: string, y: string) => [
      manifestFile({ id: "a" }),
      f("modules/a/a.contract.ts", `${HEAD}${S}export const a = contract('a', { 'a.x': ${x}, 'a.y': ${y} })\n`),
    ];
    expect(has(two("{ path: '/p' }", "{ path: '/p' }"), "E1502")).toBe(true);
    expect(
      has(
        two(
          "{ method: 'GET', path: '/p', output: s.json() }",
          "{ method: 'POST', path: '/p', body: s.object({}), output: s.json() }",
        ),
        "E1502",
      ),
    ).toBe(false);
    expect(
      has(
        two("{ method: 'GET', path: '/p', output: s.json() }", "{ method: 'GET', path: '/p', output: s.json() }"),
        "E1502",
      ),
    ).toBe(true);
  });
});

describe("retired codes", () => {
  test("No diagnostic of `check` has code E1561, E1507, E1512 or E1157 for any input", () => {
    const RETIRED = ["E1561", "E1507", "E1512", "E1157"];
    const trees = [
      // E1157's old trigger: a link to a route another module does not list
      [
        manifestFile({ id: "b" }),
        f(
          "modules/b/b.contract.ts",
          `${HEAD}export const b = contract('b', { 'b.pub': { path: '/pub' }, 'b.priv': { path: '/priv' } })\n`,
        ),
        manifestFile({ id: "a", deps: ["b"] }),
        f("modules/a/Back.ts", "import { b } from '../b/b.contract.ts'\nexport const Back = b.href('b.priv')\n"),
      ],
      // E1507's old trigger: an annotated `params` on a loader's `fn`
      [
        f(
          "src/load.server.ts",
          "import { loader } from '@keel/router'\ndeclare const Out: unknown\nexport const load = loader({ output: Out }, async ({ params }: { params: unknown }) => params)\n",
        ),
      ],
    ];
    for (const files of trees) {
      for (const d of check(files, NO_TYPES).diagnostics) expect(RETIRED).not.toContain(d.code);
    }
    fc.assert(
      fc.property(fc.constantFrom(...RETIRED), lowerId, (code, id) => {
        const files = [manifestFile({ id }), f(`modules/${id}/note.ts`, `// ${code}\nexport const note = 1\n`)];
        expect(check(files, NO_TYPES).diagnostics.map((d) => d.code)).not.toContain(code);
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  test("`reportedCodes()` lists E1407, E1513, E1514 and E1515 and none of the retired codes", () => {
    const reported = reportedCodes();
    for (const code of ["E1407", "E1513", "E1514", "E1515"]) expect(reported).toContain(code);
    for (const code of ["E1561", "E1507", "E1512", "E1157"]) expect(reported).not.toContain(code);
  });
});

describe("E1513 contract reached but by a direct call of its import", () => {
  const IMPORT = "import { contract } from '@keel/router/contract'\nimport * as k from '@keel/router/contract'\n";
  const OWN = "export const a = contract('a', { 'a.home': { path: '/' } })\n";
  const file = (extra: string) => [manifestFile({ id: "a" }), f("modules/a/a.contract.ts", `${IMPORT}${OWN}${extra}`)];
  const refused: Record<string, string> = {
    "an alias": "const mk = contract\nvoid mk\n",
    "a value use": "export const list = [contract]\n",
    "a destructured namespace": "const { contract: c } = k\nvoid c\n",
    "a computed member": "k['contract']('a', { 'a.two': { path: '/two' } })\n",
    "a re-export by name": "export { contract } from '@keel/router/contract'\n",
    "a re-export by *": "export * from '@keel/router/contract'\n",
    "a dynamic import": "void import('@keel/router/contract')\n",
  };

  test("the baseline file, one direct call of its import, is no E1513", () => {
    expect(has(file(""), "E1513")).toBe(false);
  });

  test("an alias, a value use, a destructured namespace, a computed member, a re-export by name or `*` and a dynamic import are each E1513 with no fix", () => {
    for (const [form, source] of Object.entries(refused)) {
      const d = codesOf(file(source), "E1513");
      expect(d.length, form).toBeGreaterThanOrEqual(1);
      expect(d[0]?.fix, form).toBeUndefined();
    }
  });

  test("a renamed import and a namespace import are read: each call is the contract, so a bad entry in it is E1503 and the placement is no E1513", () => {
    const bad = "'a.show': { path: '/:id' }";
    const renamed = [
      manifestFile({ id: "a" }),
      f(
        "modules/a/a.contract.ts",
        `import { contract as make } from '@keel/router/contract'\nexport const a = make('a', { ${bad} })\n`,
      ),
    ];
    const ns = [
      manifestFile({ id: "a" }),
      f(
        "modules/a/a.contract.ts",
        `import * as k from '@keel/router/contract'\nexport const a = k.contract('a', { ${bad} })\n`,
      ),
    ];
    for (const files of [renamed, ns]) {
      expect(has(files, "E1513")).toBe(false);
      expect(codesOf(files, "E1503")).toHaveLength(1);
    }
  });
});
