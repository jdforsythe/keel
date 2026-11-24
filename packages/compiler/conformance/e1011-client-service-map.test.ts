// Spec: k.bundle, Rules "E1011 a client bundle holds a file of an app module of a `node` or `static` deployable that its service map omits (Service map)"
// Spec: k.bundle, Service map "E1011: after bundling, a `client` deployable's build in `keel build` fails, exits 1 and writes nothing for it, when its graph holds a file under `modules/<id>/`, `<id>` listed by a `node` or `static` deployable and not in the map, that is neither server-only by name nor a stub. One line, no position, no fix: `E1011 <id> is not in the client's service map: imported by <file>`, the file first by absolute path among such files, `<file>` the project-relative path of the first file the bundler records importing it. `keel check`, `keel dev` and every other build report no E1011."
// Spec: k.bundle, Conformance "A fixture with topology `api` (`node`, module `notes`) and `web` (`client`, module `app`, its page `modules/app/Page.tsx`), `notes` holding `notes.contract.ts`, `lib.ts` (`export const lib = 'x'`), `T.ts` (`export type T = string`), both public, and a loader in `ping.server.ts`, and a symlink `node_modules/linked-notes` to `modules/notes`: a page importing `linked-notes/lib.ts`, with no other import of `notes` in `app`, makes `keel build` exit 1 printing exactly one E1011 line, `E1011 notes is not in the client's service map: imported by modules/app/Page.tsx`."
// Spec: k.bundle, Conformance "In that fixture, `keel build` exits 0 with no E1011 when the page imports nothing of `notes`, when it imports `../notes/notes.contract.ts` and calls `service({ contract: notes })`, when beside `linked-notes/lib.ts` it imports `./client.ts` which imports `../notes/lib.ts`; it prints no E1011 when the page's one import of `notes` is `../notes/ping.server.ts`."
// Spec: k.bundle, Conformance "In that fixture, a page holding `linked-notes/lib.ts` and also `import type { T } from '../notes/T.ts'`, or `// import { lib } from '../notes/lib.ts'`, makes `keel build` print one E1011 for `notes`; with the topology `site` (`static`, module `notes`) and `web`, no `node` deployable, `linked-notes/lib.ts` prints none."
// Seed: 1337.
// Reading: the fixture's `web` client deployable is named `web`, so "writes nothing for it" is read as no `dist/web` after the build. The E1011 line is read from the text `keel build` prints (lines holding `E1011`).
// Reading: `app` lists `notes` in `deps` when its page imports it by a relative specifier and `notes` is public in `lib` and `T`, so the module rules (E1151, E1152) have nothing to say of the relative imports; only an alias reaches `notes` unchecked.
// Reading: "exits 0" is asserted as the bullet states it, though k.bundle Aliases makes `linked-notes/lib.ts` an E1013 in `keel check`, which `keel build` runs first (k.boundary Build gate); reported as a spec contradiction.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import fc from "fast-check";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

const SLOW = 180_000;
const SEED = 1337;
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const BIN = join(REPO, "packages", "cli", "src", "bin.ts");

const LINKED = (mod: string): string => `import { lib } from "linked-${mod}/lib.ts";\n`;
const BODY = `export default function Page() {\n  return <Box as="main"><Text>web</Text></Box>;\n}\n`;
const UIIMPORT = `import { Box, Text } from "@keel/ui";\n`;

/** The page source of each variant of the fixture's `modules/app/Page.tsx`; `mod` is the module id (`notes` in the spec). */
const PAGES = {
  linked: (mod: string): string =>
    `${UIIMPORT}${LINKED(mod)}export default function Page() {\n  return <Box as="main"><Text>{lib}</Text></Box>;\n}\n`,
  none: (): string => `${UIIMPORT}${BODY}`,
  called: (mod: string): string =>
    `import type { Ctx } from "@keel/ctx";\nimport { service } from "@keel/services";\n${UIIMPORT}import { ${mod} as c } from "../${mod}/${mod}.contract.ts";\nconst svc = service({ contract: c });\nexport default function Page(_props: unknown, ctx: Ctx) {\n  void svc.ping({}, ctx);\n  return <Box as="main"><Text>web</Text></Box>;\n}\n`,
  beside: (mod: string): string =>
    `${UIIMPORT}${LINKED(mod)}import { client } from "./client.ts";\nexport default function Page() {\n  return <Box as="main"><Text>{lib}{client}</Text></Box>;\n}\n`,
  ping: (mod: string): string =>
    `${UIIMPORT}import { ping } from "../${mod}/ping.server.ts";\nexport default function Page() {\n  return <Box as="main"><Text>{typeof ping}</Text></Box>;\n}\n`,
  typeImport: (mod: string): string =>
    `${UIIMPORT}${LINKED(mod)}import type { T } from "../${mod}/T.ts";\nexport default function Page() {\n  const t: T = lib;\n  return <Box as="main"><Text>{t}</Text></Box>;\n}\n`,
  commentImport: (mod: string): string =>
    `${UIIMPORT}${LINKED(mod)}// import { lib } from '../${mod}/lib.ts'\nexport default function Page() {\n  return <Box as="main"><Text>{lib}</Text></Box>;\n}\n`,
};
type Variant = keyof typeof PAGES;
/** The variants whose page imports `notes` by a relative specifier, so `app` lists it in `deps` (E1152, E1165). */
const RELATIVE: ReadonlySet<Variant> = new Set<Variant>(["called", "beside", "ping", "typeImport"]);

const manifestSrc = (id: string, deps: string[], exports: string[]): string =>
  `import { module } from "@keel/compiler";\nexport default module({ id: "${id}", deps: [${deps.map((d) => `"${d}"`).join(", ")}], capabilities: [], public: { exports: [${exports.map((e) => `"${e}"`).join(", ")}] } });\n`;

function tree(mod: string, variant: Variant, siteTopology: boolean): Record<string, string> {
  return {
    "package.json": `${JSON.stringify({ name: "fx", private: true, type: "module" })}\n`,
    "topology.ts": siteTopology
      ? `import { topology } from "@keel/server";\nexport default topology({ site: { modules: ["${mod}"], adapter: "static" }, web: { modules: ["app"], adapter: "client" } });\n`
      : `import { topology } from "@keel/server";\nexport default topology({ api: { modules: ["${mod}"], adapter: "node" }, web: { modules: ["app"], adapter: "client" } });\n`,
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
    "modules/app/Page.tsx": PAGES[variant](mod),
    ...(variant === "beside"
      ? { "modules/app/client.ts": `import { lib } from "../${mod}/lib.ts";\nexport const client = lib;\n` }
      : {}),
    "modules/app/module.ts": manifestSrc("app", RELATIVE.has(variant) ? [mod] : [], []),
    "modules/app/routes.ts":
      'import { manifest } from "@keel/router";\nimport { app } from "./app.contract.ts";\nimport Page from "./Page.tsx";\nexport const routes = manifest(app, { "app.home": { component: Page } });\n',
    "modules/app/app.contract.ts":
      'import { contract } from "@keel/router/contract";\nexport const app = contract("app", { "app.home": { path: "/" } });\n',
    [`modules/${mod}/module.ts`]: manifestSrc(mod, [], ["lib", "T"]),
    [`modules/${mod}/lib.ts`]: `export const lib = 'x';\n`,
    [`modules/${mod}/T.ts`]: `export type T = string;\n`,
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

/** Build a fixture project through `keel build`; return the exit status, the E1011 lines, the whole output and whether `dist/web` exists. */
function buildFixture(
  mod: string,
  variant: Variant,
  siteTopology = false,
): { status: number | null; e1011: string[]; out: string; wrote: boolean } {
  const dir = mkdtempSync(join(scratch, "p-"));
  dirs.push(dir);
  for (const [p, c] of Object.entries(tree(mod, variant, siteTopology))) {
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
  const out = `${r.stdout}\n${r.stderr}`;
  return {
    status: r.status,
    e1011: out.split("\n").filter((l) => l.includes("E1011")),
    out,
    wrote: existsSync(join(dir, "dist", "web")),
  };
}

const LINE = (id: string, file: string): string =>
  `E1011 ${id} is not in the client's service map: imported by ${file}`;

describe("k.bundle Service map: E1011 after bundling, a client deployable's build in keel build fails", () => {
  test(
    "a page importing `linked-notes/lib.ts`, with no other import of `notes` in `app`, makes `keel build` exit 1 printing exactly one E1011 line, `E1011 notes is not in the client's service map: imported by modules/app/Page.tsx`",
    () => {
      const r = buildFixture("notes", "linked");
      expect(r.status, r.out).toBe(1);
      expect(r.e1011, r.out).toHaveLength(1);
      expect(r.e1011[0]).toContain(LINE("notes", "modules/app/Page.tsx"));
    },
    SLOW,
  );

  test(
    "the E1011 line has no position and no fix: nothing follows the file, no `line:col`, no `fix`",
    () => {
      const r = buildFixture("notes", "linked");
      const line = r.e1011[0] ?? "";
      const after = line.slice(line.indexOf("modules/app/Page.tsx") + "modules/app/Page.tsx".length);
      expect(after).not.toMatch(/^:\d/);
      expect(line).not.toMatch(/fix/i);
    },
    SLOW,
  );

  test(
    "the failed client build writes nothing for it: no `dist/web`",
    () => {
      expect(buildFixture("notes", "linked").wrote).toBe(false);
    },
    SLOW,
  );

  test(
    "`keel build` exits 0 with no E1011 when the page imports nothing of `notes`",
    () => {
      const r = buildFixture("notes", "none");
      expect(r.e1011).toEqual([]);
      expect(r.status, r.out).toBe(0);
    },
    SLOW,
  );

  test(
    "`keel build` exits 0 with no E1011 when the page imports `../notes/notes.contract.ts` and calls `service({ contract: notes })`",
    () => {
      const r = buildFixture("notes", "called");
      expect(r.e1011).toEqual([]);
      expect(r.status, r.out).toBe(0);
    },
    SLOW,
  );

  test(
    "`keel build` exits 0 with no E1011 when beside `linked-notes/lib.ts` the page imports `./client.ts` which imports `../notes/lib.ts`",
    () => {
      const r = buildFixture("notes", "beside");
      expect(r.e1011).toEqual([]);
      expect(r.status, r.out).toBe(0);
    },
    SLOW,
  );

  test(
    "`keel build` prints no E1011 when the page's one import of `notes` is `../notes/ping.server.ts`",
    () => {
      expect(buildFixture("notes", "ping").e1011).toEqual([]);
    },
    SLOW,
  );

  test(
    "a page holding `linked-notes/lib.ts` and also `import type { T } from '../notes/T.ts'` makes `keel build` print one E1011 for `notes`",
    () => {
      const r = buildFixture("notes", "typeImport");
      expect(r.e1011, r.out).toHaveLength(1);
      expect(r.e1011[0]).toContain("E1011 notes is not in the client's service map");
    },
    SLOW,
  );

  test(
    "a page holding `linked-notes/lib.ts` and also `// import { lib } from '../notes/lib.ts'` makes `keel build` print one E1011 for `notes`",
    () => {
      const r = buildFixture("notes", "commentImport");
      expect(r.e1011, r.out).toHaveLength(1);
      expect(r.e1011[0]).toContain("E1011 notes is not in the client's service map");
    },
    SLOW,
  );

  test(
    "with the topology `site` (`static`, module `notes`) and `web`, no `node` deployable, `linked-notes/lib.ts` prints no E1011",
    () => {
      expect(buildFixture("notes", "linked", true).e1011).toEqual([]);
    },
    SLOW,
  );

  // Seed 1337.
  test(
    "property: for any module id, the linked import is one E1011 line naming that module and the page, and no import is none",
    () => {
      fc.assert(
        fc.property(
          fc.stringMatching(/^[a-z]{4,8}$/).filter((s) => s !== "web" && s !== "app" && s !== "site"),
          (id) => {
            const bad = buildFixture(id, "linked");
            expect(bad.status).toBe(1);
            expect(bad.e1011).toHaveLength(1);
            expect(bad.e1011[0]).toContain(LINE(id, "modules/app/Page.tsx"));
            expect(buildFixture(id, "none").e1011).toEqual([]);
          },
        ),
        { seed: SEED, numRuns: 2 },
      );
    },
    SLOW * 2,
  );
});
