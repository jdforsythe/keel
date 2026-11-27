// Shared helpers for the k.e2e-run sandbox conformance files (not a test file). Seed: n/a (no generated input but the seam values of e2e-sandbox-seam-values.test.ts, seed 1337 there).
// Method: the real `keel` binary over a temp project (static-support.ts's `staticTree`, `@keel/*` linked as compat-support.ts does) holding one e2e file that writes a marker file when it runs, so "ran no test" is read from the project folder and "ran" likewise.
// The cases that let the browser check pass need `playwright-core` and Chromium that can start its sandbox on this machine (packages/testing/conformance/e2e-support.ts says how they are provided); none skips for that.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, symlinkSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fixedTime } from "@keel/tooling/test-time";
import { cleanup, materialize } from "./compat-support.ts";
import { staticTree } from "./static-support.ts";

export const SEED = 1337; // seed 1337
export const SLOW = fixedTime(600_000);
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const BIN = join(REPO, "packages", "cli", "src", "bin.ts");
export const MARKER = "ran.marker";
const made: string[] = [];
export const cleanupAll = (): void => {
  for (const d of made) cleanup(d);
};

export const root = typeof process.getuid === "function" && process.getuid() === 0;
export const rootLinux = root && process.platform === "linux";

function playwrightCore(): string | undefined {
  const hoisted = join(REPO, "node_modules", "playwright-core");
  if (existsSync(hoisted)) return hoisted;
  const store = join(REPO, "node_modules", ".pnpm");
  const found = existsSync(store) ? readdirSync(store).find((n) => n.startsWith("playwright-core@")) : undefined;
  return found === undefined ? undefined : join(store, found, "node_modules", "playwright-core");
}
function typesNode(): string | undefined {
  const hoisted = join(REPO, "node_modules", "@types", "node");
  if (existsSync(hoisted)) return hoisted;
  const store = join(REPO, "node_modules", ".pnpm");
  const found = existsSync(store)
    ? readdirSync(store)
        .filter((n) => n.startsWith("@types+node@"))
        .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))[0]
    : undefined;
  return found === undefined ? undefined : join(store, found, "node_modules", "@types", "node");
}

const B_E2E = `import { writeFileSync } from "node:fs";
import { expect, it } from "vitest";
it("b", () => {
  writeFileSync("${MARKER}", "ran");
  expect(1).toBe(1);
});
`;

/** A project whose one e2e file, `test/b.e2e.ts`, writes `ran.marker` in the project folder when it runs, `playwright-core` linked. */
export function project(): string {
  const dir = materialize({ ...staticTree(), "test/b.e2e.ts": B_E2E });
  made.push(dir);
  const pw = playwrightCore();
  if (pw !== undefined) symlinkSync(pw, join(dir, "node_modules", "playwright-core"));
  const types = typesNode();
  if (types !== undefined) {
    mkdirSync(join(dir, "node_modules", "@types"), { recursive: true });
    symlinkSync(types, join(dir, "node_modules", "@types", "node"));
  }
  return dir;
}
export const ran = (dir: string): boolean => existsSync(join(dir, MARKER));

export type Rec = {
  kind: string;
  code?: unknown;
  message?: unknown;
  path?: unknown;
  fix?: unknown;
  [k: string]: unknown;
};
export type Out = { status: number | null; stdout: string; records: Rec[] };
const isRec = (v: unknown): v is Rec =>
  typeof v === "object" && v !== null && "kind" in v && typeof v.kind === "string";

/** `keel <args>` in `dir` with no `KEEL_*` of this run's environment, `extra` added; a wait the build and browser take, so fixed time. */
export function run(
  dir: string,
  args: readonly string[],
  format: "json" | "compact",
  extra: Record<string, string> = {},
): Out {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v === undefined || k.startsWith("VITEST") || k.startsWith("KEEL_")) continue;
    if (k === "NODE_OPTIONS" || k === "TEST" || k === "NODE_ENV") continue;
    env[k] = v;
  }
  const r = spawnSync(process.execPath, [BIN, ...args, `--format=${format}`], {
    cwd: dir,
    encoding: "utf8",
    env: { ...env, ...extra },
    timeout: fixedTime(540_000),
    killSignal: "SIGKILL",
  });
  const records: Rec[] = [];
  if (format === "json")
    for (const line of r.stdout.split("\n")) {
      if (line.trim() === "") continue;
      try {
        const v: unknown = JSON.parse(line);
        if (isRec(v)) records.push(v);
      } catch {
        // not a record
      }
    }
  return { status: r.status, stdout: r.stdout, records };
}
export const diags = (o: Out, code: string): Rec[] => o.records.filter((r) => r.kind === "diag" && r.code === code);
export const reports = (dir: string): string[] =>
  existsSync(join(dir, "reports/tests")) ? readdirSync(join(dir, "reports/tests")).sort() : [];
