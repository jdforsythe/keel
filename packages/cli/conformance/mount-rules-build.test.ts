// k.mount, Rules "E1580 `identity.ts` whose default export is not `identityMount('<literal>')` of lowercase `/` segments, optionally with `{ links: [...] }`, or with no `identity.server.ts` giving `handle: { path: <its default import>.path }` (a literal there too) · E1581 a module file importing `identity.ts` where a `static` deployable, or a `client` one without `servedBy`, serves the module: no origin of it mounts `handle` · E1582 a `subpath` `href` refuses (`keel check` for a literal; the call throws) · E1583 a native submit with a file chosen · E1584 a `links` entry not a string literal, `''`, not of `subpath`'s form, or repeated (`keel check`; the call throws). Fix: none, but E1589's below."
// Spec: k.mount, clause "E1580, E1581 and E1582 each have a triggering fixture and a clean one; a chosen file is E1583, nothing recorded."
// k.mount, Declaration "`identity.server.ts` then gives `handle: { path: <its default import>.path, fn }`."
// Seed 1337 (fc.assert below). In-memory project through `run(['build'])` and `run(['check'])`, as identity-e1579-build.test.ts. The in-process
// `check()` cases are packages/check/conformance/mount-rules.test.ts.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { run } from "@keel/cli";
import fc from "fast-check";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { SEED } from "./topology-modules.ts";

const ROOT_PKGS = ["compiler", "router", "schema", "server", "ctx"];
let tmp = "";
beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "keel-mount-"));
  fs.mkdirSync(path.join(tmp, "node_modules", "@keel"), { recursive: true });
  for (const p of ROOT_PKGS) {
    fs.symlinkSync(path.resolve(import.meta.dirname, "..", "..", p), path.join(tmp, "node_modules", "@keel", p));
  }
});
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

type File = { path: string; source: string };
const manifestSrc = (id: string) =>
  `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: [], capabilities: [], public: { exports: [] } })\n`;
const routesSrc = (id: string, p: string) =>
  `import { manifest } from '@keel/router'\nimport { ${id} } from './${id}.contract.ts'\nconst Page = () => null\nexport const routes = manifest(${id}, { '${id}.page': { component: Page } })\n`;
const contractSrc = (id: string, p: string) =>
  `import { contract } from '@keel/router/contract'\nexport const ${id} = contract('${id}', { '${id}.page': { path: '${p}' } })\n`;
const identitySrc = (arg: string) =>
  `import { identityMount } from '@keel/router'\nexport default identityMount(${arg})\n`;
const SERVER = `import { identity } from '@keel/server'\nimport mount from './identity.ts'\nexport default identity({ identify: async () => '', handle: { path: mount.path, fn: () => new Response('') } })\n`;
const topologySrc = (deployables: string) =>
  `import { topology } from '@keel/server'\nexport default topology({ ${deployables} })\n`;
const useSrc = (call: string) => `import mount from '../../identity.ts'\nexport const signin = ${call}\n`;
const NODE = "web: { modules: ['a'], adapter: 'node' }";

function project(o: {
  readonly identity?: string;
  /** The whole `identity.ts`, instead of `identityMount(<identity>)`. */
  readonly identityFile?: string;
  readonly server?: boolean;
  readonly deployables?: string;
  readonly call?: string;
  readonly route?: string;
  readonly extra?: readonly File[];
}): File[] {
  return [
    { path: "topology.ts", source: topologySrc(o.deployables ?? NODE) },
    { path: "identity.ts", source: o.identityFile ?? identitySrc(o.identity ?? "'/api/auth'") },
    ...(o.server === false ? [] : [{ path: "identity.server.ts", source: SERVER }]),
    { path: "modules/a/module.ts", source: manifestSrc("a") },
    { path: "modules/a/routes.ts", source: routesSrc("a", o.route ?? "/orders") },
    { path: "modules/a/a.contract.ts", source: contractSrc("a", o.route ?? "/orders") },
    { path: "modules/a/signin.ts", source: useSrc(o.call ?? "mount.href('/sign-in/email')") },
    ...(o.extra ?? []),
  ];
}

const diagnostics = async (command: "build" | "check", files: File[], code: string) => {
  const r = await run([command, "--format=json"], { cwd: tmp, env: { KEEL_AGENT: "1" }, files });
  return r.stdout.split("\n").filter((l) => l.includes(`"${code}"`));
};
const COMMANDS = ["check", "build"] as const;

describe("k.mount: E1580 in keel check and keel build", () => {
  test("an `identity.ts` with a variable path is one E1580, and `identityMount('/api/auth')` beside `handle: { path: mount.path }` is none", async () => {
    for (const command of COMMANDS) {
      const variable =
        "import { identityMount } from '@keel/router'\nconst p = '/api/auth'\nexport default identityMount(p)\n";
      expect(await diagnostics(command, project({ identityFile: variable }), "E1580")).toHaveLength(1);
      expect(await diagnostics(command, project({}), "E1580")).toEqual([]);
    }
  });

  test("`identityMount('/API')` and an `identity.ts` with no `identity.server.ts` are each one E1580", async () => {
    for (const command of COMMANDS) {
      expect(await diagnostics(command, project({ identity: "'/API'" }), "E1580")).toHaveLength(1);
      expect(await diagnostics(command, project({ server: false }), "E1580")).toHaveLength(1);
    }
  });

  test("a route at or under the mount path, declared only in `identity.ts`, is one E1579", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom("/api/auth", "/api/auth/x", "/api/auth/x/y"), async (route) => {
        for (const command of COMMANDS) {
          expect(await diagnostics(command, project({ route }), "E1579")).toHaveLength(1);
          expect(await diagnostics(command, project({ route: "/orders" }), "E1579")).toEqual([]);
        }
      }),
      { seed: SEED, numRuns: 3 },
    );
  });
});

describe("k.mount: E1581 in keel check and keel build", () => {
  const SHELLS = "shells: { tauri: { id: 'dev.keel.mount', name: 'Mount' } }";
  const peer: File = { path: "modules/b/module.ts", source: manifestSrc("b") };
  const placements: readonly (readonly [string, string, readonly File[]])[] = [
    ["a `static` deployable", "web: { modules: ['a'], adapter: 'static' }", []],
    ["a `client` deployable without `servedBy`", "web: { modules: ['a'], adapter: 'client' }", []],
  ];

  for (const [name, deployables, extra] of placements) {
    test(`a module file importing \`identity.ts\` served by ${name} is one E1581`, async () => {
      for (const command of COMMANDS) {
        expect(await diagnostics(command, project({ deployables, extra }), "E1581")).toHaveLength(1);
      }
    });
  }

  test("the same module on a `node` deployable, and on a `client` deployable with `servedBy`, with or without `shells`, is clean", async () => {
    const shelled = `api: { modules: ['b'], adapter: 'node' }, web: { modules: ['a'], adapter: 'client', servedBy: 'api', ${SHELLS} }`;
    for (const command of COMMANDS) {
      expect(await diagnostics(command, project({ deployables: shelled, extra: [peer] }), "E1581")).toEqual([]);
    }
    const hosted =
      "api: { modules: ['b'], adapter: 'node' }, web: { modules: ['a'], adapter: 'client', servedBy: 'api' }";
    for (const command of COMMANDS) {
      expect(await diagnostics(command, project({}), "E1581")).toEqual([]);
      expect(await diagnostics(command, project({ deployables: hosted, extra: [peer] }), "E1581")).toEqual([]);
    }
  });
});

describe("k.topology: a leftover `host` key in keel build and keel check", () => {
  test("`keel build` of a `client` deployable with `host: 'api'` prints one E1552 naming `host` and exits 1 with no E1581", async () => {
    const deployables =
      "api: { modules: ['b'], adapter: 'node' }, web: { modules: ['a'], adapter: 'client', host: 'api' }";
    const files = project({ deployables, extra: [{ path: "modules/b/module.ts", source: manifestSrc("b") }] });
    const r = await run(["build", "--format=json"], { cwd: tmp, env: { KEEL_AGENT: "1" }, files });
    expect(r.code).toBe(1);
    const lines = r.stdout.split("\n").filter((l) => l.includes('"E1552"'));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("host");
    expect(r.stdout).not.toContain('"E1581"');
  });
});

describe("k.mount: E1582 in keel check and keel build", () => {
  test("`mount.href('/a/..')` and `mount.href('//x')` in a module file are each one E1582", async () => {
    for (const command of COMMANDS) {
      for (const call of ["mount.href('/a/..')", "mount.href('//x')"]) {
        expect(await diagnostics(command, project({ call }), "E1582"), call).toHaveLength(1);
      }
    }
  });

  test("`mount.href('/sign-in/email')` and a non-literal subpath are clean", async () => {
    for (const command of COMMANDS) {
      expect(await diagnostics(command, project({}), "E1582")).toEqual([]);
      const files = project({}).map((x) =>
        x.path === "modules/a/signin.ts"
          ? {
              ...x,
              source:
                "import mount from '../../identity.ts'\ndeclare const sub: string\nexport const signin = mount.href(sub)\n",
            }
          : x,
      );
      expect(await diagnostics(command, files, "E1582")).toEqual([]);
    }
  });
});
