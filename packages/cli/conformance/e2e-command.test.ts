// Spec: k.e2e, clause "`keel test` in a project holding `test/a.test.ts` and `test/b.e2e.ts` runs `a.test.ts` alone; `keel test --e2e` runs `b.e2e.ts` alone, after `keel build` has written `dist/`."
// Spec: k.e2e, clause "`keel test --e2e` in a project with no `playwright-core` installed prints one E1734 `playwright-core is not installed`, runs no test, reports none skipped and exits 1."
// Spec: k.e2e, clause "`keel test --e2e` in a project with no e2e file prints `ok test 0 tests` and leaves `dist/` as it was."
// Spec: k.e2e, clause "A test calling `renderRoute` in `test/b.e2e.ts` fails with E1736, and `serve()` in `test/a.test.ts` under `keel test` rejects E1736."
// Spec: k.e2e, clause "`keel test --e2e` writes `reports/tests/e2e.json` and leaves `reports/tests/run.json`; a later `keel test` writes `run.json` and leaves `e2e.json`."
// Spec: k.e2e, clause "An `it` calling `serve` and declaring no timeout has 60 s, and 6 s with `KEEL_TEST_TIME_SCALE=0.1`."
// k.e2e Rules E1734 (the browser is missing), E1736 (a harness call in an e2e file: `render`, `renderRoute`, `resumeDocument`, `simulate`; `@keel/testing/e2e` called when `KEEL_E2E` is not `1`) and E1701 holding in an e2e file
// (k.e2e Files) are asserted by the cases after the clauses. E1737 and the `page` form of E1736 are asserted in packages/testing/conformance/e2e-serve.test.ts.
// Seed: n/a (no generated input: the numbers are the clauses' own). Method: the real `keel` binary over temp projects (static-support.ts's `staticTree`, `@keel/*` linked as compat-support.ts does) in compact or json format.
// The cases that run an e2e file need Chromium and `playwright-core` (packages/testing/conformance/e2e-support.ts says how they are provided); none skips. The E1734 case links no `playwright-core` into the project:
// ASSUMED that the product resolves it from the project's folder (the fix adds it to the project's `devDependencies`), so the repo's own copy does not satisfy it.
// UNTESTABLE here: the second E1734 form (`the <engine> browser is not installed: run playwright-core install <engine>`) needs a browser to be uninstalled; the machine's installs are not touched.
import { fixedTime } from "@keel/tooling/test-time";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { cleanup, materialize, write } from "./compat-support.ts";
import { staticTree } from "./static-support.ts";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const BIN = join(REPO, "packages", "cli", "src", "bin.ts");
const SLOW = 600_000;
const made: string[] = [];
afterAll(() => {
  for (const d of made) cleanup(d);
});

function playwrightCore(): string | undefined {
  const hoisted = join(REPO, "node_modules", "playwright-core");
  if (existsSync(hoisted)) return hoisted;
  const store = join(REPO, "node_modules", ".pnpm");
  const found = existsSync(store) ? readdirSync(store).find((n) => n.startsWith("playwright-core@")) : undefined;
  return found === undefined ? undefined : join(store, found, "node_modules", "playwright-core");
}

/** A built-app fixture project (`staticTree`) plus `files`, `playwright-core` linked unless `playwright` is false. */
function project(files: Record<string, string>, playwright = true): string {
  const dir = materialize({ ...staticTree(), ...files });
  made.push(dir);
  const pw = playwrightCore();
  if (playwright && pw !== undefined) symlinkSync(pw, join(dir, "node_modules", "playwright-core"));
  return dir;
}

type Rec = { kind: string; code?: unknown; message?: unknown; path?: unknown; fix?: unknown; [k: string]: unknown };
type Out = { status: number | null; stdout: string; records: Rec[] };
const isRec = (v: unknown): v is Rec =>
  typeof v === "object" && v !== null && "kind" in v && typeof v.kind === "string";

/** `keel <args>` in `dir` with no `KEEL_*` of this run's env, `extra` added; a wait the build and browser take, so fixed time. */
function run(
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

const reports = (dir: string): string[] =>
  existsSync(join(dir, "reports/tests")) ? readdirSync(join(dir, "reports/tests")).sort() : [];
const reportFiles = (dir: string, name: string): string[] => {
  const text = readFileSync(join(dir, "reports/tests", name), "utf8");
  const report: unknown = JSON.parse(text);
  const files = typeof report === "object" && report !== null ? Reflect.get(report, "files") : undefined;
  return typeof files === "object" && files !== null ? Object.keys(files).sort() : [];
};
const stateOf = (dir: string, name: string, file: string): string[] => {
  const report: unknown = JSON.parse(readFileSync(join(dir, "reports/tests", name), "utf8"));
  const files = typeof report === "object" && report !== null ? Reflect.get(report, "files") : undefined;
  const entry = typeof files === "object" && files !== null ? Reflect.get(files, file) : undefined;
  const tests = typeof entry === "object" && entry !== null ? Reflect.get(entry, "tests") : undefined;
  return Array.isArray(tests) ? tests.map((t) => String(Reflect.get(Object(t), "state"))) : [];
};
/** Every file under `dir/<sub>` with a hash of its bytes, or none. */
function snapshot(dir: string, sub: string): string[] {
  const out: string[] = [];
  const walk = (rel: string): void => {
    const full = join(dir, rel);
    if (!existsSync(full)) return;
    if (statSync(full).isDirectory()) {
      for (const n of readdirSync(full).sort()) walk(join(rel, n));
    } else out.push(`${rel} ${createHash("sha256").update(readFileSync(full)).digest("hex")}`);
  };
  walk(sub);
  return out;
}

const A_TEST = 'import { expect, it } from "vitest";\nit("a", () => {\n  expect(1).toBe(1);\n});\n';
const B_E2E =
  'import { existsSync } from "node:fs";\nimport { expect, it } from "vitest";\nit("b", () => {\n  expect(existsSync("dist/site/index.html")).toBe(true);\n});\n';

describe("k.e2e: the command", () => {
  it(
    "`keel test` in a project holding `test/a.test.ts` and `test/b.e2e.ts` runs `a.test.ts` alone; `keel test --e2e` runs `b.e2e.ts` alone, after `keel build` has written `dist/`",
    () => {
      const dir = project({ "test/a.test.ts": A_TEST, "test/b.e2e.ts": B_E2E });
      const plain = run(dir, ["test"], "json");
      expect(plain.status).toBe(0);
      expect(reportFiles(dir, "run.json")).toEqual(["test/a.test.ts"]);
      expect(existsSync(join(dir, "dist"))).toBe(false);
      const e2e = run(dir, ["test", "--e2e"], "json");
      expect(e2e.status, e2e.stdout.slice(-2000)).toBe(0);
      expect(reportFiles(dir, "e2e.json")).toEqual(["test/b.e2e.ts"]);
      expect(stateOf(dir, "e2e.json", "test/b.e2e.ts")).toEqual(["passed"]);
    },
    SLOW,
  );

  it(
    "`keel test --e2e` in a project with no `playwright-core` installed prints one E1734 `playwright-core is not installed`, runs no test, reports none skipped and exits 1",
    () => {
      const dir = project({ "test/b.e2e.ts": B_E2E }, false);
      const out = run(dir, ["test", "--e2e"], "json");
      expect(out.status).toBe(1);
      const e1734 = out.records.filter((r) => r.kind === "diag" && r.code === "E1734");
      expect(e1734).toHaveLength(1);
      expect(String(e1734[0]?.message)).toBe("playwright-core is not installed");
      expect(String(e1734[0]?.path)).toBe("package.json");
      expect(String(e1734[0]?.fix)).toContain("playwright-core");
      const summary = out.records.filter((r) => r.kind === "summary").at(-1);
      expect(summary?.skipped ?? 0).toBe(0);
      expect(summary?.tests ?? 0).toBe(0);
      expect(reports(dir)).not.toContain("e2e.json");
    },
    SLOW,
  );

  it(
    "`keel test --e2e` in a project with no e2e file prints `ok test 0 tests` and leaves `dist/` as it was",
    () => {
      const dir = project({ "test/a.test.ts": A_TEST });
      const bare = run(dir, ["test", "--e2e"], "compact");
      expect(bare.status).toBe(0);
      expect(bare.stdout).toContain("ok test 0 tests");
      expect(existsSync(join(dir, "dist"))).toBe(false);
      expect(run(dir, ["build"], "json").status).toBe(0);
      const before = snapshot(dir, "dist");
      expect(before.length).toBeGreaterThan(0);
      const again = run(dir, ["test", "--e2e"], "compact");
      expect(again.stdout).toContain("ok test 0 tests");
      expect(snapshot(dir, "dist")).toEqual(before);
    },
    SLOW,
  );

  it(
    "A test calling `renderRoute` in `test/b.e2e.ts` fails with E1736, and `serve()` in `test/a.test.ts` under `keel test` rejects E1736",
    () => {
      const calls = ["render", "renderRoute", "resumeDocument", "simulate"] as const;
      const files: Record<string, string> = {
        "test/a.test.ts":
          'import { expect, it } from "vitest";\nimport { serve } from "@keel/testing/e2e";\nit("serve outside an e2e run", async () => {\n  const error: unknown = await serve().then(() => undefined, (e: unknown) => e);\n  expect(Reflect.get(Object(error), "code")).toBe("E1736");\n});\n',
      };
      for (const c of calls)
        files[`test/call-${c}.e2e.ts`] =
          `import * as testing from "@keel/testing";\nimport { it } from "vitest";\nit("${c} in an e2e file", async () => {\n  const call: unknown = Reflect.get(testing, "${c}");\n  if (typeof call === "function") await call();\n});\n`;
      const dir = project(files);
      const plain = run(dir, ["test"], "json");
      expect(plain.status, plain.stdout.slice(-2000)).toBe(0);
      expect(stateOf(dir, "run.json", "test/a.test.ts")).toEqual(["passed"]);
      const out = run(dir, ["test", "--e2e"], "json");
      expect(out.status).toBe(1);
      for (const c of calls) {
        const named = out.records.filter(
          (r) =>
            r.kind === "diag" &&
            (r.code === "E1736" || String(r.message).includes("E1736")) &&
            String(r.path).includes(`call-${c}`),
        );
        expect(named.length, `${c} is E1736`).toBeGreaterThan(0);
      }
    },
    SLOW,
  );

  it(
    "`keel test --e2e` writes `reports/tests/e2e.json` and leaves `reports/tests/run.json`; a later `keel test` writes `run.json` and leaves `e2e.json`",
    () => {
      const dir = project({ "test/a.test.ts": A_TEST, "test/b.e2e.ts": B_E2E });
      run(dir, ["test"], "json");
      const runBefore = readFileSync(join(dir, "reports/tests/run.json"), "utf8");
      expect(reports(dir)).toEqual(["run.json"]);
      const e2e = run(dir, ["test", "--e2e"], "json");
      expect(e2e.status, e2e.stdout.slice(-2000)).toBe(0);
      expect(reports(dir)).toEqual(["e2e.json", "run.json"]);
      expect(readFileSync(join(dir, "reports/tests/run.json"), "utf8")).toBe(runBefore);
      const e2eBefore = readFileSync(join(dir, "reports/tests/e2e.json"), "utf8");
      write(dir, { "test/a.test.ts": `${A_TEST}// edited\n` });
      run(dir, ["test"], "json");
      expect(reports(dir)).toEqual(["e2e.json", "run.json"]);
      expect(readFileSync(join(dir, "reports/tests/e2e.json"), "utf8")).toBe(e2eBefore);
      expect(readFileSync(join(dir, "reports/tests/run.json"), "utf8")).not.toBe(runBefore);
    },
    SLOW,
  );

  it(
    "An `it` calling `serve` and declaring no timeout has 60 s, and 6 s with `KEEL_TEST_TIME_SCALE=0.1`",
    () => {
      const body =
        'import { writeFileSync } from "node:fs";\nimport { it } from "vitest";\nimport { serve } from "@keel/testing/e2e";\nit("serves", async ({ task }) => {\n  await serve();\n  writeFileSync("timeout.txt", String(task.timeout));\n});\n';
      const dir = project({ "test/t.e2e.ts": body });
      // the clause's numbers are at scale 1 and 0.1 whatever scale this run has: each child sets its own
      for (const [scale, ms] of [
        ["1", "60000"],
        ["0.1", "6000"],
      ] as const) {
        rmSync(join(dir, "timeout.txt"), { force: true });
        const out = run(dir, ["test", "--e2e"], "json", { KEEL_TEST_TIME_SCALE: scale });
        expect(out.status, out.stdout.slice(-2000)).toBe(0);
        expect(readFileSync(join(dir, "timeout.txt"), "utf8")).toBe(ms);
      }
    },
    SLOW,
  );

  it(
    "E1701 holds in an e2e file: a DOM query is E1701, and `keel build` failing stops the run before the browser check",
    () => {
      const dir = project(
        {
          "test/q.e2e.ts":
            'import { it } from "vitest";\nit("queries", () => {\n  const el = document.querySelector("#total");\n  void el;\n});\n',
        },
        false,
      );
      const out = run(dir, ["test", "--e2e"], "json");
      expect(out.status).toBe(1);
      expect(out.records.some((r) => r.kind === "diag" && r.code === "E1701")).toBe(true);
      expect(out.records.some((r) => r.code === "E1734")).toBe(false);
    },
    SLOW,
  );
});
