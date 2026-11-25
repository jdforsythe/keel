// k.user, Rules "E1592 `identity.server.ts`, or a project file it imports, importing a module's `routes` (`modules/<id>/routes.ts`, or a stdlib package's `./routes` export) where a `static` deployable, or a `client` one without `servedBy`, serves that module: its pages are on another origin than every `handle`, so no sign-in returns to them (at the import; `keel check`, `keel build`)"
// k.user, Identity source "`routes` holds only the pages the deployable serves. Where the pages a sign-in returns to belong to another deployable served from the same origin (`servedBy`), the identity source builds the table with `routeTable(routes, thatTable)` before it calls `pageHref`. A page another origin serves is never a return target: an `Href` is root-relative and `pageHref` answers only a page of its table, so the only tables to join are those of deployables whose pages this origin answers: a `client` one through `servedBy`, a `node` peer through forwarding (k.topology). A `static` deployable, or a `client` one without `servedBy`, is on another origin: to return to its pages, serve them from a `node` deployable (`servedBy`) (k.mount Origins)."
// Spec: k.user, clause "In a project with no `identity.ts`, modules `notes` (one page, `/`) and `api` (no route), and `identity.server.ts` importing `./modules/notes/routes.ts`: `keel check` and `keel build` give one E1592 at that import for `topology({ web: { modules: ['notes'], adapter: 'client' }, api: { modules: ['api'], adapter: 'node' } })` and for the same with `web` `adapter: 'static'`, and none with `web` `adapter: 'client', servedBy: 'api'` or `adapter: 'node'`; with the import moved to a project-root file `returns.ts` that `identity.server.ts` imports, the first topology gives one E1592 at the import in `returns.ts` and none in `identity.server.ts`."
// RFC 0224 E1592: message `<id> pages are on another origin; a sign-in cannot return there` (the code is the diagnostic's `code`, as for E1589), no fix.
// Seed 1337 (fc.assert below). `keel build` is packages/cli/conformance/identity-e1592-build.test.ts. In-memory project, `check(files, { types: false })`.
// Untestable here: the stdlib `./routes` export branch (a std package's routes need that package installed; kernel conformance never imports std). "At the import" is read as the import declaration's line in its file.
// Expected red until E1592 is built.
import { check } from "@keel/check";
import { explain } from "@keel/check/explain";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { type Files, SEED } from "./support.ts";

const f = (path: string, source: string): Files[number] => ({ path, source });
const MANIFEST = (id: string): string =>
  `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: [], capabilities: [], public: { exports: [] } })\n`;
const ROUTES = (id: string): string =>
  `import { manifest } from '@keel/router'\nimport { ${id} } from './${id}.contract.ts'\nconst Page = () => null\nexport const routes = manifest(${id}, { '${id}.page': { component: Page } })\n`;
const CONTRACT = (id: string): string =>
  `import { contract } from '@keel/router/contract'\nexport const ${id} = contract('${id}', { '${id}.page': { path: '/' } })\n`;
const SERVER = (imports: string, use: string): string =>
  `import { identity } from '@keel/server'\n${imports}export default identity({ identify: async () => '', handle: { path: '/api/auth', fn: () => new Response(${use}) } })\n`;
const IMPORT = (id: string): string => `import { routes as ${id}Routes } from './modules/${id}/routes.ts'\n`;
const msg = (id: string): string => `${id} pages are on another origin; a sign-in cannot return there`;

const topo = (deployables: readonly string[]): Files[number] =>
  f(
    "topology.ts",
    `import { topology } from '@keel/server'\nexport default topology({\n${deployables.map((d) => `  ${d},`).join("\n")}\n})\n`,
  );
const moduleFiles = (id: string, withRoutes: boolean): Files => [
  f(`modules/${id}/module.ts`, MANIFEST(id)),
  ...(withRoutes ? [f(`modules/${id}/routes.ts`, ROUTES(id)), f(`modules/${id}/${id}.contract.ts`, CONTRACT(id))] : []),
];
const API = "api: { modules: ['api'], adapter: 'node' }";
const web = (adapter: string, extra = ""): string => `web: { modules: ['notes'], adapter: '${adapter}'${extra} }`;

/** `identity.server.ts` imports `notes`' routes directly. */
const direct = (deployables: readonly string[]): Files => [
  topo(deployables),
  ...moduleFiles("notes", true),
  ...moduleFiles("api", false),
  f("identity.server.ts", SERVER(IMPORT("notes"), "String(notesRoutes)")),
];
/** `identity.server.ts` imports `returns.ts`, which imports `notes`' routes. */
const viaFile = (deployables: readonly string[]): Files => [
  topo(deployables),
  ...moduleFiles("notes", true),
  ...moduleFiles("api", false),
  f("returns.ts", `${IMPORT("notes")}export const table = notesRoutes\n`),
  f("identity.server.ts", SERVER("import { table } from './returns.ts'\n", "String(table)")),
];
const only = (files: Files) => check(files, { types: false }).diagnostics.filter((d) => d.code === "E1592");
const lineOf = (files: Files, path: string, needle: string): number =>
  (files.find((x) => x.path === path)?.source ?? "").split("\n").findIndex((l) => l.includes(needle)) + 1;

describe("k.user: E1592 a sign-in returns only to a page its own origin answers", () => {
  test("`identity.server.ts` importing `./modules/notes/routes.ts`, with `web` a `client` deployable without `servedBy`, is one E1592 at that import", () => {
    const files = direct([web("client"), API]);
    const d = only(files);
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ path: "identity.server.ts", line: lineOf(files, "identity.server.ts", "routes.ts") });
  });

  test("the same with `web` a `static` deployable is one E1592 at that import", () => {
    const files = direct([web("static"), API]);
    const d = only(files);
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ path: "identity.server.ts", line: lineOf(files, "identity.server.ts", "routes.ts") });
  });

  test("with `web` a `client` deployable `servedBy: 'api'`, or a `node` deployable, E1592 reports none", () => {
    expect(only(direct([web("client", ", servedBy: 'api'"), API]))).toEqual([]);
    expect(only(direct([web("node"), API]))).toEqual([]);
  });

  test("the message is `<id> pages are on another origin; a sign-in cannot return there`", () => {
    const d = only(direct([web("client"), API]));
    expect(d[0]?.message).toBe(msg("notes"));
  });

  test("E1592 carries no fix", () => {
    for (const adapter of ["client", "static"]) {
      const d = only(direct([web(adapter), API]));
      expect(d).toHaveLength(1);
      expect(d[0]?.fix).toBeUndefined();
    }
  });

  test("with the import moved to a project-root file `returns.ts` that `identity.server.ts` imports, one E1592 at the import in `returns.ts` and none in `identity.server.ts`", () => {
    const files = viaFile([web("client"), API]);
    const d = only(files);
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ path: "returns.ts", line: lineOf(files, "returns.ts", "routes.ts") });
    expect(d.filter((x) => x.path === "identity.server.ts")).toEqual([]);
  });

  test("the transitive import is none when the pages are served from the identity origin", () => {
    expect(only(viaFile([web("client", ", servedBy: 'api'"), API]))).toEqual([]);
    expect(only(viaFile([web("node"), API]))).toEqual([]);
  });

  test("a file `identity.server.ts` does not import, importing a foreign module's routes, is no E1592", () => {
    const files: Files = [
      topo([web("client"), API]),
      ...moduleFiles("notes", true),
      ...moduleFiles("api", false),
      f("identity.server.ts", SERVER("", "''")),
      f("elsewhere.ts", `${IMPORT("notes")}export const t = notesRoutes\n`),
    ];
    expect(only(files)).toEqual([]);
  });

  test("a project with no `identity.server.ts` importing the routes of a `client` deployable without `servedBy` is no E1592", () => {
    const files: Files = [
      topo([web("client"), API]),
      ...moduleFiles("notes", true),
      ...moduleFiles("api", false),
      f("other.ts", `${IMPORT("notes")}export const t = notesRoutes\n`),
    ];
    expect(only(files)).toEqual([]);
  });

  test("E1592 is independent of `identity.ts`: with `identity.ts` beside it the import is still one E1592", () => {
    const files: Files = [
      ...direct([web("static"), API]),
      f("identity.ts", "import { identityMount } from '@keel/router'\nexport default identityMount('/api/auth')\n"),
    ];
    expect(only(files)).toHaveLength(1);
  });

  test("a module of another deployable's pages joined with a foreign one reports only the foreign module", () => {
    const files: Files = [
      topo([web("client"), "docs: { modules: ['docs'], adapter: 'client', servedBy: 'api' }", API]),
      ...moduleFiles("notes", true),
      ...moduleFiles("docs", true),
      ...moduleFiles("api", false),
      f("identity.server.ts", SERVER(`${IMPORT("notes")}${IMPORT("docs")}`, "String([notesRoutes, docsRoutes])")),
    ];
    const d = only(files);
    expect(d).toHaveLength(1);
    expect(d[0]?.message).toBe(msg("notes"));
  });

  test("over deployable keys, module ids and placements, E1592 is one exactly for `static` and for `client` without `servedBy`", () => {
    const placements = fc.constantFrom(
      { adapter: "client", extra: "", hit: true },
      { adapter: "static", extra: "", hit: true },
      { adapter: "client", extra: ", servedBy: 'api'", hit: false },
      { adapter: "node", extra: "", hit: false },
    );
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-z][a-z0-9]{0,8}$/),
        fc.stringMatching(/^[a-z][a-z0-9]{0,8}$/),
        placements,
        fc.boolean(),
        (key, id, p, viaReturns) => {
          fc.pre(key !== "api" && id !== "api" && key !== "shells");
          const deployables = [`${key}: { modules: ['${id}'], adapter: '${p.adapter}'${p.extra} }`, API];
          const base: Files = [
            topo(deployables),
            ...moduleFiles(id, true),
            ...moduleFiles("api", false),
            ...(viaReturns
              ? [
                  f("returns.ts", `import { routes } from './modules/${id}/routes.ts'\nexport const table = routes\n`),
                  f("identity.server.ts", SERVER("import { table } from './returns.ts'\n", "String(table)")),
                ]
              : [
                  f(
                    "identity.server.ts",
                    SERVER(`import { routes } from './modules/${id}/routes.ts'\n`, "String(routes)"),
                  ),
                ]),
          ];
          const d = only(base);
          expect(d).toHaveLength(p.hit ? 1 : 0);
          if (p.hit) {
            expect(d[0]?.message).toBe(msg(id));
            expect(d[0]?.path).toBe(viaReturns ? "returns.ts" : "identity.server.ts");
          }
        },
      ),
      { seed: SEED, numRuns: 40 },
    );
  });

  test("`keel explain E1592` names the code and the fix, `servedBy`", () => {
    const text = explain("E1592");
    expect(text).toContain("E1592");
    expect(text).toContain("servedBy");
  });
});
