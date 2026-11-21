// Spec: k.bundle, Rules "E1011 a client bundle holds a module its service map omits"; the message form `E1011 <module> is not in the client's service map: imported by <file>`.
// Seed: 1337.
// The spec text is one line, so the conditions are the rule's own: the client build fails when a file bundled into the client belongs to an app module of
// a node or static deployable that the client's service map omits. ASSUMED: "mapped" means the client calls `service({ contract })` for the module's
// contract; "unmapped" means a client file reaches the module's file through a bare package-style specifier (`linked-<module>`, a symlink in the fixture's
// `node_modules` to the module's folder, so the type checker and the bundler both resolve it) and the client does not call it. A plain relative import of an uncalled module's public file built with no
// E1011 in this fixture; that is not asserted either way. Diagnostics are read from the text `keel build` prints, the module and the file in the E1011 line.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import fc from "fast-check";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

const SLOW = 180_000;
const SEED = 1337;
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const BIN = join(REPO, "packages", "cli", "src", "bin.ts");

type Variant = "unmapped" | "relative-called" | "none";

const manifestSrc = (id: string): string =>
  `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: [], capabilities: [], public: { exports: [] } })\n`;
const contractSrc = (id: string): string =>
  `import { contract } from '@keel/router/contract'\nexport const ${id} = contract('${id}', { '${id}.page': { path: '/${id}' } })\n`;

function tree(mod: string, variant: Variant): Record<string, string> {
  const page =
    variant === "unmapped"
      ? `import { Box, Text } from "@keel/ui";\nimport { lib } from "linked-${mod}/lib.ts";\nexport default function Page() {\n  return <Box as="main"><Text>{lib}</Text></Box>;\n}\n`
      : variant === "relative-called"
        ? `import type { Ctx } from "@keel/ctx";\nimport { service } from "@keel/services";\nimport { Box, Text } from "@keel/ui";\nimport { ${mod} as c } from "../${mod}/${mod}.contract.ts";\nconst svc = service({ contract: c });\nexport default function Page(_props: unknown, ctx: Ctx) {\n  void svc.ping({}, ctx);\n  return <Box as="main"><Text>web</Text></Box>;\n}\n`
        : `import { Box, Text } from "@keel/ui";\nexport default function Page() {\n  return <Box as="main"><Text>web</Text></Box>;\n}\n`;
  return {
    "package.json": `${JSON.stringify({ name: "fx", private: true, type: "module" })}\n`,
    "topology.ts": `import { topology } from "@keel/server";\nexport default topology({ api: { modules: ["${mod}"], adapter: "node" }, web: { modules: ["app"], adapter: "client" } });\n`,
    "vite.config.ts": `import keel from "@keel/compiler/vite";\nimport { defineConfig } from "vite";\nexport default defineConfig({ plugins: [keel()] });\n`,
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        jsx: "react-jsx",
        jsxImportSource: "@keel/runtime-dom",
        module: "esnext",
        target: "es2022",
        moduleResolution: "bundler",
      },
    }),
    "modules/app/Page.tsx": page,
    "modules/app/module.ts": `import { module } from "@keel/compiler";\nexport default module({ id: "app", deps: [${variant === "none" ? "" : `"${mod}"`}], capabilities: [], public: { exports: [] } });\n`,
    "modules/app/routes.ts":
      'import { manifest } from "@keel/router";\nimport { app } from "./app.contract.ts";\nimport Page from "./Page.tsx";\nexport const routes = manifest(app, { "app.home": { component: Page } });\n',
    "modules/app/app.contract.ts":
      'import { contract } from "@keel/router/contract";\nexport const app = contract("app", { "app.home": { path: "/" } });\n',
    [`modules/${mod}/module.ts`]: `import { module } from "@keel/compiler";\nexport default module({ id: "${mod}", deps: [], capabilities: [], public: { exports: ["lib"] } });\n`,
    [`modules/${mod}/lib.ts`]: `export const lib = "x";\n`,
    [`modules/${mod}/routes.ts`]: `import { manifest } from "@keel/router";\nimport { ${mod} } from "./${mod}.contract.ts";\nimport { ping } from "./ping.server.ts";\nexport const routes = manifest(${mod}, { "${mod}.ping": { loader: ping } });\n`,
    [`modules/${mod}/${mod}.contract.ts`]: `import { contract } from "@keel/router/contract";\nimport { s } from "@keel/schema";\nexport const ${mod} = contract("${mod}", { "${mod}.ping": { method: "GET", path: "/api/ping", output: s.object({ n: s.int() }) } });\n`,
    [`modules/${mod}/ping.server.ts`]: `import { loader } from "@keel/router";\nimport { ok } from "@keel/schema";\nimport { ${mod} } from "./${mod}.contract.ts";\nexport const ping = loader(${mod}, "${mod}.ping", {}, async () => ok({ n: 1 }));\n`,
  };
}

const dirs: string[] = [];
let scratch = "";
beforeAll(() => {
  scratch = mkdtempSync(join(tmpdir(), "keel-e1011-"));
}, SLOW);
afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
  rmSync(scratch, { recursive: true, force: true });
});

/** Build a fixture project through `keel build`; return the exit status and the E1011 lines. */
function buildFixture(mod: string, variant: Variant): { status: number | null; e1011: string[] } {
  const dir = mkdtempSync(join(scratch, "p-"));
  dirs.push(dir);
  for (const [p, c] of Object.entries(tree(mod, variant))) {
    mkdirSync(dirname(join(dir, p)), { recursive: true });
    writeFileSync(join(dir, p), c);
  }
  mkdirSync(join(dir, "node_modules/@keel"), { recursive: true });
  for (const pkg of readdirSync(join(REPO, "packages")))
    symlinkSync(join(REPO, "packages", pkg), join(dir, "node_modules/@keel", pkg));
  symlinkSync(join(dir, "modules", mod), join(dir, "node_modules", `linked-${mod}`));
  symlinkSync(join(REPO, "node_modules", "vite"), join(dir, "node_modules", "vite"));
  mkdirSync(join(dir, "node_modules", ".bin"), { recursive: true });
  symlinkSync("../vite/bin/vite.js", join(dir, "node_modules", ".bin", "vite"));
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v === undefined || k.startsWith("VITEST") || k.startsWith("KEEL_")) continue;
    if (k === "NODE_OPTIONS" || k === "TEST") continue;
    env[k] = v;
  }
  env.KEEL_AGENT = "1";
  const r = spawnSync(process.execPath, [BIN, "build"], { cwd: dir, encoding: "utf8", env, timeout: 150_000 });
  const e1011 = `${r.stdout}\n${r.stderr}`.split("\n").filter((l) => l.includes("E1011"));
  return { status: r.status, e1011 };
}

describe("k.bundle: E1011 a client bundle holds a module its service map omits", () => {
  test(
    "an aliased import of a node module's file that the client does not call (not in its service map) fails with E1011 naming the module and the importing file",
    () => {
      const r = buildFixture("notes", "unmapped");
      expect(r.status).not.toBe(0);
      expect(r.e1011).toHaveLength(1);
      expect(r.e1011[0]).toContain("E1011 notes is not in the client's service map: imported by modules/app/Page.tsx");
    },
    SLOW,
  );

  test(
    "a relative import of a called module builds, the module is mapped, and there is no E1011",
    () => {
      const r = buildFixture("notes", "relative-called");
      expect(r.e1011).toEqual([]);
      expect(r.status).toBe(0);
    },
    SLOW,
  );

  test(
    "a client that imports no server module builds with no E1011",
    () => {
      const r = buildFixture("notes", "none");
      expect(r.e1011).toEqual([]);
      expect(r.status).toBe(0);
    },
    SLOW,
  );

  test(
    "property: for any module id, an unmapped import is one E1011 naming that module and an absent import is none",
    () => {
      fc.assert(
        fc.property(
          fc.stringMatching(/^[a-z]{4,8}$/).filter((s) => s !== "web"),
          (id) => {
            const bad = buildFixture(id, "unmapped");
            expect(bad.e1011).toHaveLength(1);
            expect(bad.e1011[0]).toContain(`E1011 ${id} is not in the client's service map: imported by `);
            expect(buildFixture(id, "none").e1011).toEqual([]);
          },
        ),
        { seed: SEED, numRuns: 2 },
      );
    },
    SLOW * 2,
  );
});
