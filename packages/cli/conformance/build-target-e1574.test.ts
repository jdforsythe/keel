// Spec: k.shell, clause "With `api`, `keel build --target tauri` with `KEEL_ORIGIN` unset, and with it empty, prints one E1574 naming it and builds nothing; with `http://localhost:8080` it proceeds."
// k.shell, Build 2 "With a `node` deployable in the topology, `KEEL_ORIGIN` unset or empty, or not `https:` outside `localhost`, is E1574 `KEEL_ORIGIN must be an https: origin (http: on localhost only)`; ... Neither names the value."
// k.shell, Rules "E1574 a shell build's `KEEL_ORIGIN` unset, empty or invalid with a `node` deployable, or set with none (names the key)"
// The fixture has a `node` deployable `api` beside `web` (the clause's `api`).
// Seed: 1337.
// No native tool runs: `PATH`, `HOME`, `CARGO_HOME` and `RUSTUP_HOME` point at an empty directory, so "proceeds" is read as "reports no E1574";
// it then stops at the toolchain step (E1575, k.shell Build 2), before any tool runs. `KEEL_ORIGIN` validity is decided by step 1, before any work.
import { testTime } from "@keel/tooling/test-time";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import fc from "fast-check";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { type Rec, cleanup, materialize } from "./compat-support.ts";

const SLOW = 300_000;
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const BIN = join(REPO, "packages", "cli", "src", "bin.ts");

const manifestSrc = (id: string): string =>
  `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: [], capabilities: [], public: { exports: [] } })\n`;
const files = (): Record<string, string> => ({
  "package.json": `${JSON.stringify({ name: "fx", private: true, type: "module", version: "1.0.0", dependencies: { "@keel/std-tauri": "workspace:*" } })}\n`,
  "vite.config.ts":
    'import keel from "@keel/compiler/vite";\nimport { defineConfig } from "vite";\nexport default defineConfig({ plugins: [keel()] });\n',
  "tsconfig.json": JSON.stringify({
    compilerOptions: { jsx: "react-jsx", jsxImportSource: "@keel/runtime-dom", module: "esnext", target: "es2022" },
  }),
  "topology.ts":
    "import { topology } from '@keel/server'\nexport default topology({\n  web: { modules: ['c'], adapter: 'client', shells: { tauri: { id: 'dev.keel.golden', name: 'Golden' } } },\n  api: { modules: [], adapter: 'node' },\n})\n",
  "modules/c/module.ts": manifestSrc("c"),
  "modules/c/routes.ts":
    "import { manifest } from '@keel/router'\nimport { c } from './c.contract.ts'\nconst Page = () => null\nexport const routes = manifest(c, { 'c.page': { component: Page } })\n",
  "modules/c/c.contract.ts":
    "import { contract } from '@keel/router/contract'\nexport const c = contract('c', { 'c.page': { path: '/' } })\n",
});

let project = "";
let empty = "";
beforeAll(() => {
  project = materialize(files());
  empty = mkdtempSync(join(tmpdir(), "keel-empty-path-"));
}, SLOW);
afterAll(() => {
  cleanup(project);
  rmSync(empty, { recursive: true, force: true });
});

/** `keel build --target tauri` with no tool findable and `KEEL_ORIGIN` as given (undefined: unset). */
function build(origin: string | undefined, format = "json"): { status: number | null; records: Rec[]; out: string } {
  const env: Record<string, string> = { PATH: empty, HOME: empty, CARGO_HOME: empty, RUSTUP_HOME: empty };
  for (const [k, v] of Object.entries(process.env)) {
    if (v === undefined || k.startsWith("VITEST") || k.startsWith("KEEL_") || k in env) continue;
    if (k === "NODE_OPTIONS" || k === "TEST" || k === "JAVA_HOME" || k === "ANDROID_HOME") continue;
    env[k] = v;
  }
  env.PATH = empty;
  if (origin !== undefined) env.KEEL_ORIGIN = origin;
  const r = spawnSync(process.execPath, [BIN, "build", "--target", "tauri", `--format=${format}`], {
    cwd: project,
    encoding: "utf8",
    env,
    timeout: testTime(120_000),
  });
  const records: Rec[] = [];
  for (const line of r.stdout.split("\n")) {
    if (line.trim() === "") continue;
    try {
      const v: unknown = JSON.parse(line);
      if (typeof v === "object" && v !== null && "kind" in v && typeof v.kind === "string")
        records.push({ ...v, kind: v.kind });
    } catch {
      // non-JSON line: ignored
    }
  }
  return { status: r.status, records, out: `${r.stdout}\n${r.stderr}` };
}
const e1574 = (run: { records: Rec[] }): Rec[] => run.records.filter((r) => r.kind === "diag" && r.code === "E1574");

const label = fc.stringMatching(/^[a-z]{3,10}$/);

describe("k.shell: E1574", () => {
  test(
    "with `api`, `keel build --target tauri` with `KEEL_ORIGIN` unset, and with it empty, prints one E1574 naming it and builds nothing; with `http://localhost:8080` it proceeds.",
    () => {
      for (const origin of [undefined, ""]) {
        const bad = build(origin);
        expect(e1574(bad), String(origin)).toHaveLength(1);
        expect(String(e1574(bad)[0]?.message)).toContain("KEEL_ORIGIN");
        expect(bad.status).toBe(1);
        expect(existsSync(join(project, "dist", "web"))).toBe(false);
      }

      const local = build("http://localhost:8080");
      expect(e1574(local)).toEqual([]);
    },
    SLOW,
  );

  test(
    "with `api`, the E1574 of an unset, empty or invalid `KEEL_ORIGIN` is `KEEL_ORIGIN must be an https: origin (http: on localhost only)` and holds no part of the value",
    () => {
      fc.assert(
        fc.property(
          label.map((l) => `q9${l}`),
          (host) => {
            for (const bad of [undefined, "", `http://${host}.example`, `${host}.example`]) {
              const run = build(bad, "compact");
              expect(run.out, String(bad)).toContain(
                "E1574 KEEL_ORIGIN must be an https: origin (http: on localhost only)\n  see: keel docs k.shell",
              );
              expect(run.out.match(/E1574/g) ?? []).toHaveLength(1);
              if (bad !== undefined && bad !== "") expect(run.out).not.toContain(host);
            }
          },
        ),
        { seed: 1337, numRuns: 2 },
      );
    },
    SLOW,
  );

  test(
    "E1574 a shell build's `KEEL_ORIGIN` unset, empty or invalid with a `node` deployable (names the key)",
    () => {
      fc.assert(
        fc.property(label, label, (host, other) => {
          // not `https:` outside `localhost`: one E1574 naming the key, nothing built
          for (const bad of [
            `http://${host}.example`,
            `ftp://${host}.example`,
            `${host}.example`,
            "",
            `http://${other}.test:8080`,
          ]) {
            const run = build(bad);
            expect(e1574(run), bad).toHaveLength(1);
            expect(String(e1574(run)[0]?.message)).toContain("KEEL_ORIGIN");
            expect(existsSync(join(project, "dist", "web", "tauri"))).toBe(false);
          }
          // valid: `https:` anywhere, or any scheme on `localhost`
          for (const good of [
            `https://${host}.example`,
            `https://${host}.example:8443`,
            "http://localhost:8080",
            "https://localhost",
          ]) {
            expect(e1574(build(good)), good).toEqual([]);
          }
        }),
        { seed: 1337, numRuns: 2 },
      );
    },
    SLOW,
  );
});
