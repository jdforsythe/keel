// Spec: k.privacy, Rules "E1111 a `.pii()` or `s.secret` node in a route `params` or `search` schema (fix: none), or a route table, entry, `params` or `search` it cannot read statically (a factory call, a computed key)" Conformance "A marked or `s.secret` field in a route's `params` or `search` schema is E1111; in an action `input` it is not."
// Seed: 1337.
// Skipped until E1111 exists. E1111 has no fix; the no-fix list in fix-diffs.test.ts records it.
import { check } from "@keel/check";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { Files } from "./support.ts";
import { SEED } from "./support.ts";

const f = (path: string, source: string): Files[number] => ({ path, source });
const MANIFEST = f(
  "modules/app/module.ts",
  `import { module } from '@keel/compiler'\nexport default module({ id: 'app', deps: [], capabilities: [], public: { exports: [] } })\n`,
);
const e1111 = (files: Files) =>
  check([MANIFEST, ...files], { types: false }).diagnostics.filter((d) => d.code === "E1111");

const S = `import { s } from '@keel/schema'\n`;
const CLASSES = ["name", "contact", "location", "identifier", "financial", "special", "network", "content"] as const;
const classArb = fc.constantFrom(...CLASSES);

/** A contract with `params` and `search` schemas, both optional leaves so E1503/E1504 stay quiet. */
const routes = (extraImport: string, params: string, search: string) =>
  f(
    "modules/app/app.contract.ts",
    `import { contract } from '@keel/router/contract'\n${extraImport}` +
      `export const app = contract('app', {\n  'app.show': { path: '/show/:id', params: ${params}, search: ${search} },\n})\n`,
  );
const PARAMS = (leaf: string) => `s.object({ id: ${leaf} })`;
const SEARCH = (leaf: string) => `s.object({ q: ${leaf}.optional() })`;
const PLAIN = "s.string()";

describe("k.privacy E1111", () => {
  it("E1111 fires on a marked field in a route's `params` schema, for every class, and not on the unmarked twin", () => {
    fc.assert(
      fc.property(classArb, (cls) => {
        const bad = routes(S, PARAMS(`s.string().pii('${cls}')`), SEARCH(PLAIN));
        const clean = routes(S, PARAMS(PLAIN), SEARCH(PLAIN));
        const ds = e1111([bad]);
        expect(ds).toHaveLength(1);
        expect(ds[0]?.fix).toBeUndefined();
        expect(ds[0]?.see).toBe("k.privacy");
        expect(e1111([clean])).toHaveLength(0);
      }),
      { seed: SEED, numRuns: 30 },
    );
  });

  it("E1111 fires on a marked field in a route's `search` schema, for every class, and not on the unmarked twin", () => {
    fc.assert(
      fc.property(classArb, (cls) => {
        const bad = routes(S, PARAMS(PLAIN), SEARCH(`s.string().pii('${cls}')`));
        const clean = routes(S, PARAMS(PLAIN), SEARCH(PLAIN));
        const ds = e1111([bad]);
        expect(ds).toHaveLength(1);
        expect(ds[0]?.fix).toBeUndefined();
        expect(e1111([clean])).toHaveLength(0);
      }),
      { seed: SEED, numRuns: 30 },
    );
  });

  it("E1111 fires on a marked node nested in an object or an array inside `params` or `search`", () => {
    const nested = (leaf: string) => `s.object({ id: s.string(), more: s.object({ deep: ${leaf} }) })`;
    expect(e1111([routes(S, nested("s.string().pii('contact')"), SEARCH(PLAIN))])).toHaveLength(1);
    expect(e1111([routes(S, nested(PLAIN), SEARCH(PLAIN))])).toHaveLength(0);
    const inArray = (leaf: string) => `s.object({ tags: s.array(${leaf}).optional() })`;
    expect(e1111([routes(S, PARAMS(PLAIN), inArray("s.string().pii('content')"))])).toHaveLength(1);
    expect(e1111([routes(S, PARAMS(PLAIN), inArray(PLAIN))])).toHaveLength(0);
  });

  it("E1111 fires when the marked schema is an imported const from a schema file", () => {
    const schemaFile = (leaf: string) =>
      f("modules/app/Params.schema.ts", `${S}export const Params = s.object({ id: ${leaf} })\n`);
    const table = routes(`import { Params } from './Params.schema.ts'\n`, "Params", SEARCH(PLAIN));
    expect(e1111([schemaFile("s.string().pii('identifier')"), table])).toHaveLength(1);
    expect(e1111([schemaFile(PLAIN), table])).toHaveLength(0);
  });

  it("E1111 does not fire on a marked field in an action `input`", () => {
    const Edit = (leaf: string) =>
      f("modules/app/Edit.schema.ts", `${S}export const Edit = s.object({ note: ${leaf}, email: ${leaf} })\n`);
    const save = f(
      "modules/app/save.server.ts",
      `import { action } from '@keel/router'\nimport { ok } from '@keel/schema'\nimport { app } from './app.contract.ts'\nimport { Edit } from './Edit.schema.ts'\n` +
        `export const save = action(app, 'app.show', { input: Edit }, () => Promise.resolve(ok(null)))\n`,
    );
    const table = f(
      "modules/app/routes.ts",
      `import { manifest } from '@keel/router'\nimport { app } from './app.contract.ts'\nimport { save } from './save.server.ts'\nconst Page = () => null\n` +
        `export const routes = manifest(app, { 'app.show': { component: Page, POST: save } })\n`,
    );
    const entry = f(
      "modules/app/app.contract.ts",
      `import { contract } from '@keel/router/contract'\nexport const app = contract('app', { 'app.show': { path: '/show' } })\n`,
    );
    fc.assert(
      fc.property(classArb, (cls) => {
        expect(e1111([Edit(`s.string().pii('${cls}')`), save, table, entry])).toHaveLength(0);
      }),
      { seed: SEED, numRuns: 30 },
    );
  });

  const SECRET = "s.secret(s.string())";
  const secretLeaves = [SECRET, `${SECRET}.optional()`] as const;

  it("E1111 fires on an `s.secret` field in a route's `params` or `search` schema, plain or `.optional()`, with part `params` or `search`, and not on the plain twin", () => {
    for (const leaf of secretLeaves) {
      const inParams = e1111([routes(S, PARAMS(leaf), SEARCH(PLAIN))]);
      expect(inParams).toHaveLength(1);
      expect(inParams[0]?.fix).toBeUndefined();
      expect(inParams[0]?.see).toBe("k.privacy");
      expect(inParams[0]?.message).toBe("personal data or a secret in route params; a URL reaches history and logs");
      const inSearch = e1111([routes(S, PARAMS(PLAIN), SEARCH(leaf))]);
      expect(inSearch).toHaveLength(1);
      expect(inSearch[0]?.fix).toBeUndefined();
      expect(inSearch[0]?.message).toBe("personal data or a secret in route search; a URL reaches history and logs");
    }
    expect(e1111([routes(S, PARAMS(PLAIN), SEARCH(PLAIN))])).toHaveLength(0);
  });

  it("E1111 fires on an `s.secret` field reached through a const, an import from a `*.schema.ts` file and a namespace import of `@keel/schema`", () => {
    const viaConst = routes(S, "Id", SEARCH(PLAIN)).source.replace(
      "export const app",
      `const Id = s.object({ id: ${SECRET} })\nexport const app`,
    );
    expect(e1111([f("modules/app/app.contract.ts", viaConst)])).toHaveLength(1);
    const schemaFile = (leaf: string) =>
      f("modules/app/Params.schema.ts", `${S}export const Params = s.object({ id: ${leaf} })\n`);
    const table = routes(`import { Params } from './Params.schema.ts'\n`, "Params", SEARCH(PLAIN));
    expect(e1111([schemaFile(SECRET), table])).toHaveLength(1);
    expect(e1111([schemaFile(PLAIN), table])).toHaveLength(0);
    const ns = `import * as ns from '@keel/schema'\n`;
    expect(e1111([routes(ns, "ns.s.object({ id: ns.s.secret(ns.s.string()) })", SEARCH(PLAIN))])).toHaveLength(1);
    expect(e1111([routes(ns, "ns.s.object({ id: ns.s.string() })", SEARCH(PLAIN))])).toHaveLength(0);
  });

  it("E1111 does not fire on an `s.secret` field in an action `input`", () => {
    const Edit = f("modules/app/Edit.schema.ts", `${S}export const Edit = s.object({ token: ${SECRET} })\n`);
    const save = f(
      "modules/app/save.server.ts",
      `import { action } from '@keel/router'\nimport { ok } from '@keel/schema'\nimport { app } from './app.contract.ts'\nimport { Edit } from './Edit.schema.ts'\n` +
        `export const save = action(app, 'app.show', { input: Edit }, () => Promise.resolve(ok(null)))\n`,
    );
    const table = f(
      "modules/app/routes.ts",
      `import { manifest } from '@keel/router'\nimport { app } from './app.contract.ts'\nimport { save } from './save.server.ts'\nconst Page = () => null\n` +
        `export const routes = manifest(app, { 'app.show': { component: Page, POST: save } })\n`,
    );
    const entry = f(
      "modules/app/app.contract.ts",
      `import { contract } from '@keel/router/contract'\nexport const app = contract('app', { 'app.show': { path: '/show' } })\n`,
    );
    expect(e1111([Edit, save, table, entry])).toHaveLength(0);
  });
});
