// Spec: k.user, Rules "E1592 `identity.server.ts`, or a project file it imports, importing a module's `routes` (`modules/<id>/routes.ts`, or a stdlib package's `./routes` export) where a `static` deployable, or a `client` one without `servedBy`, serves that module: its pages are on another origin than every `handle`, so no sign-in returns to them (at the import; `keel check`, `keel build`)"
// Spec: k.user, Conformance "In a project with no `identity.ts`, modules `notes` (one page, `/`) and `api` (no route), and `identity.server.ts` importing `./modules/notes/routes.ts`: `keel check` and `keel build` give one E1592 at that import for `topology({ web: { modules: ['notes'], adapter: 'client' }, api: { modules: ['api'], adapter: 'node' } })` and for the same with `web` `adapter: 'static'`, and none with `web` `adapter: 'client', servedBy: 'api'` or `adapter: 'node'`; with the import moved to a project-root file `returns.ts` that `identity.server.ts` imports, the first topology gives one E1592 at the import in `returns.ts` and none in `identity.server.ts`."
// Seed 1337 (no random inputs: the four topologies of the clause). In-memory project through `run(['build'])` and `run(['check'])`, as mount-e1589-build.test.ts.
// The in-process cases are packages/check/conformance/identity-e1592-foreign-routes.test.ts. Expected red until E1592 is built.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { run } from "@keel/cli";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

const ROOT_PKGS = ["compiler", "router", "schema", "server", "ctx"];
let tmp = "";
beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "keel-e1592-"));
  fs.mkdirSync(path.join(tmp, "node_modules", "@keel"), { recursive: true });
  for (const p of ROOT_PKGS) {
    fs.symlinkSync(path.resolve(import.meta.dirname, "..", "..", p), path.join(tmp, "node_modules", "@keel", p));
  }
});
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

type File = { path: string; source: string };
const manifestSrc = (id: string) =>
  `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: [], capabilities: [], public: { exports: [] } })\n`;
const routesSrc = (id: string) =>
  `import { manifest } from '@keel/router'\nimport { ${id} } from './${id}.contract.ts'\nconst Page = () => null\nexport const routes = manifest(${id}, { '${id}.page': { component: Page } })\n`;
const contractSrc = (id: string) =>
  `import { contract } from '@keel/router/contract'\nexport const ${id} = contract('${id}', { '${id}.page': { path: '/' } })\n`;
const IMPORT = "import { routes } from './modules/notes/routes.ts'\n";
const server = (imports: string, use: string) =>
  `import { identity } from '@keel/server'\n${imports}export default identity({ identify: async () => '', handle: { path: '/api/auth', fn: () => new Response(${use}) } })\n`;
const API = "api: { modules: ['api'], adapter: 'node' }";
const web = (adapter: string, extra = "") => `web: { modules: ['notes'], adapter: '${adapter}'${extra} }`;

function project(deployables: readonly string[], viaReturns = false): File[] {
  return [
    {
      path: "topology.ts",
      source: `import { topology } from '@keel/server'\nexport default topology({ ${deployables.join(", ")} })\n`,
    },
    { path: "modules/notes/module.ts", source: manifestSrc("notes") },
    { path: "modules/notes/routes.ts", source: routesSrc("notes") },
    { path: "modules/notes/notes.contract.ts", source: contractSrc("notes") },
    { path: "modules/api/module.ts", source: manifestSrc("api") },
    ...(viaReturns
      ? [
          { path: "returns.ts", source: `${IMPORT}export const table = routes\n` },
          { path: "identity.server.ts", source: server("import { table } from './returns.ts'\n", "String(table)") },
        ]
      : [{ path: "identity.server.ts", source: server(IMPORT, "String(routes)") }]),
  ];
}

const diagnostics = async (command: "build" | "check", files: File[]) => {
  const r = await run([command, "--format=json"], { cwd: tmp, env: { KEEL_AGENT: "1" }, files });
  return r.stdout.split("\n").filter((l) => l.includes('"E1592"'));
};
const COMMANDS = ["check", "build"] as const;

describe("k.user: E1592 in keel check and keel build", () => {
  test("`web` a `client` deployable without `servedBy`, and `web` a `static` one, are each one E1592 at the import in `identity.server.ts`", async () => {
    for (const command of COMMANDS) {
      for (const adapter of ["client", "static"]) {
        const out = await diagnostics(command, project([web(adapter), API]));
        expect(out, `${command} ${adapter}`).toHaveLength(1);
        expect(out[0]).toContain("identity.server.ts");
        expect(out[0]).toContain("notes pages are on another origin; a sign-in cannot return there");
      }
    }
  });

  test("`web` a `client` deployable `servedBy: 'api'`, or a `node` one, is no E1592", async () => {
    for (const command of COMMANDS) {
      for (const d of [
        [web("client", ", servedBy: 'api'"), API],
        [web("node"), API],
      ]) {
        expect(await diagnostics(command, project(d)), command).toEqual([]);
      }
    }
  });

  test("with the import in `returns.ts` that `identity.server.ts` imports, one E1592 at `returns.ts` and none in `identity.server.ts`", async () => {
    for (const command of COMMANDS) {
      const out = await diagnostics(command, project([web("client"), API], true));
      expect(out, command).toHaveLength(1);
      expect(out[0]).toContain("returns.ts");
      expect(out[0]).not.toContain("identity.server.ts");
    }
  });
});
