// k.mount, Rules "E1589 with `identity.ts`, a `static` deployable, or a `client` one without `servedBy` (shells or not), its key in `topology.ts`: no origin of it answers the router's `/__keel/user` read (k.guards Client); none when a module file it serves is E1581."
// Spec: k.mount, clause "With `identity.ts` and `identity.server.ts`, no module file importing `identity.ts`: `{ web: client }`, `{ web: client, shells }` and `{ site: static, api: node }` each give one E1589 at that deployable's key in `keel check` and `keel build`; `{ web: client, servedBy: 'api', api: node }` with or without `shells`, `{ api: node }` and the same topologies without `identity.ts` give none; a file of `web` importing `identity.ts` gives one E1581 and no E1589."
// Seed 1337 (fc.assert in the in-process suite packages/check/conformance/mount-e1589.test.ts). In-memory project through `run(['build'])` and `run(['check'])`, as mount-rules-build.test.ts.
// Expected red until E1589 is built.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { run } from "@keel/cli";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

const ROOT_PKGS = ["compiler", "router", "schema", "server", "ctx"];
let tmp = "";
beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "keel-e1589-"));
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
const contractSrc = (id: string, p: string) =>
  `import { contract } from '@keel/router/contract'\nexport const ${id} = contract('${id}', { '${id}.page': { path: '${p}' } })\n`;
const IDENTITY = `import { identityMount } from '@keel/router'\nexport default identityMount('/api/auth')\n`;
const SERVER = `import { identity } from '@keel/server'\nimport mount from './identity.ts'\nexport default identity({ identify: async () => '', handle: { path: mount.path, fn: () => new Response('') } })\n`;
const IMPORTS = `import mount from '../../identity.ts'\nexport const signin = mount.href('/sign-in/email')\n`;
const SHELLS = "shells: { tauri: { id: 'dev.keel.mount', name: 'Mount' } }";
const WEB = (extra = ""): string => `web: { modules: ['a'], adapter: 'client'${extra} }`;
const API = "api: { modules: ['b'], adapter: 'node' }";

function project(deployables: readonly string[], o: { identity?: boolean; importing?: boolean } = {}): File[] {
  return [
    {
      path: "topology.ts",
      source: `import { topology } from '@keel/server'\nexport default topology({\n${deployables.map((d) => `  ${d},`).join("\n")}\n})\n`,
    },
    ...(o.identity === false
      ? []
      : [
          { path: "identity.ts", source: IDENTITY },
          { path: "identity.server.ts", source: SERVER },
        ]),
    { path: "modules/a/module.ts", source: manifestSrc("a") },
    { path: "modules/a/routes.ts", source: routesSrc("a") },
    { path: "modules/a/a.contract.ts", source: contractSrc("a", "/orders") },
    { path: "modules/b/module.ts", source: manifestSrc("b") },
    { path: "modules/b/routes.ts", source: routesSrc("b") },
    { path: "modules/b/b.contract.ts", source: contractSrc("b", "/things") },
    ...(o.importing === true ? [{ path: "modules/a/signin.ts", source: IMPORTS }] : []),
  ];
}

const diagnostics = async (command: "build" | "check", files: File[], code: string) => {
  const r = await run([command, "--format=json"], { cwd: tmp, env: { KEEL_AGENT: "1" }, files });
  return r.stdout.split("\n").filter((l) => l.includes(`"${code}"`));
};
const COMMANDS = ["check", "build"] as const;

describe("k.mount: E1589 in keel check and keel build", () => {
  test("`{ web: client }` and `{ web: client, shells }` are each one E1589 naming `web` at `topology.ts`", async () => {
    for (const command of COMMANDS) {
      for (const d of [[WEB()], [WEB(`, ${SHELLS}`)]]) {
        const out = await diagnostics(command, project(d), "E1589");
        expect(out, command).toHaveLength(1);
        expect(out[0]).toContain("topology.ts");
        expect(out[0]).toContain("web (client) has no servedBy");
      }
    }
  });

  test("`{ site: static, api: node }` is one E1589 naming `site` at `topology.ts`", async () => {
    for (const command of COMMANDS) {
      const out = await diagnostics(command, project(["site: { modules: ['a'], adapter: 'static' }", API]), "E1589");
      expect(out, command).toHaveLength(1);
      expect(out[0]).toContain("topology.ts");
      expect(out[0]).toContain("site (static) serves no router");
    }
  });

  test("`{ web: client, servedBy: 'api', api: node }` with or without `shells`, and `{ api: node }`, are no E1589", async () => {
    for (const command of COMMANDS) {
      for (const d of [[WEB(", servedBy: 'api'"), API], [WEB(`, servedBy: 'api', ${SHELLS}`), API], [API]]) {
        expect(await diagnostics(command, project(d), "E1589"), command).toEqual([]);
      }
    }
  });

  test("the topologies that give E1589 give none without `identity.ts`", async () => {
    for (const command of COMMANDS) {
      for (const d of [[WEB()], [WEB(`, ${SHELLS}`)], ["site: { modules: ['a'], adapter: 'static' }", API]]) {
        expect(await diagnostics(command, project(d, { identity: false }), "E1589"), command).toEqual([]);
      }
    }
  });

  test("a file of `web` importing `identity.ts` is one E1581 and no E1589", async () => {
    for (const command of COMMANDS) {
      const files = project([WEB()], { importing: true });
      expect(await diagnostics(command, files, "E1581"), command).toHaveLength(1);
      expect(await diagnostics(command, files, "E1589"), command).toEqual([]);
    }
  });
});
