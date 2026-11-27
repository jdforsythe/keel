// @vitest-environment node
// `@keel/testing/e2e` over a built app in Chromium: the fixture project `e2e-fixture/` copied to a temporary folder
// with `@keel/*`, `@types/node`, vitest, vite, typescript and playwright-core linked, `keel test --e2e` run on it once,
// and each of its tests' outcome read from `reports/tests/e2e.json`; the failing ones' T0001 lines and files under
// `reports/e2e/` read from the run's compact output. Needs Chromium (`playwright-core install chromium`): without it
// the run is E1734 and every case here fails. The worked examples of the keel-testing and keel-deploy skills run in
// the same project, as `test/skill-*.e2e.ts`, so each example is a test that passes.
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { fixedTime } from "@keel/tooling/test-time";
import { tempDir } from "@keel/tooling/test-tmp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const REPO = join(HERE, "..", "..", "..");
const FIXTURE = join(HERE, "..", "e2e-fixture");

let dir = "";
let out = "";
let report: unknown;
let artifacts: string[] = [];

/** The first `ts` fence after `heading` in a published skill. */
function fence(skill: string, heading: string): string {
  const text = readFileSync(join(REPO, "packages", "cli", "skills", skill, "SKILL.md"), "utf8");
  const from = text.indexOf(heading);
  const open = text.indexOf("```ts\n", from);
  const close = text.indexOf("\n```", open + 6);
  if (from < 0 || open < 0 || close < 0) throw new Error(`no example after ${heading} in ${skill}`);
  return `${text.slice(open + 6, close)}\n`;
}

beforeAll(() => {
  dir = tempDir("keel-e2e-own-");
  cpSync(FIXTURE, dir, { recursive: true });
  writeFileSync(join(dir, "test", "skill-testing.e2e.ts"), fence("keel-testing", "## End to end"));
  writeFileSync(join(dir, "test", "skill-deploy.e2e.ts"), fence("keel-deploy", "**Test the built app.**"));
  mkdirSync(join(dir, "node_modules", "@keel"), { recursive: true });
  mkdirSync(join(dir, "node_modules", "@types"), { recursive: true });
  for (const pkg of readdirSync(join(REPO, "packages")))
    symlinkSync(join(REPO, "packages", pkg), join(dir, "node_modules", "@keel", pkg));
  symlinkSync(join(HERE, "..", "node_modules", "@types", "node"), join(dir, "node_modules", "@types", "node"));
  for (const name of ["vitest", "vite", "typescript", "fast-check", "playwright-core"])
    symlinkSync(join(REPO, "node_modules", name), join(dir, "node_modules", name));
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env))
    if (v !== undefined && !/^(?:VITEST|KEEL_)|^(?:NODE_OPTIONS|NODE_ENV|TEST)$/.test(k)) env[k] = v;
  // One build of the fixture and two files in a browser: the machine's own work, so fixed time.
  const r = spawnSync(
    process.execPath,
    [join(REPO, "packages", "cli", "src", "bin.ts"), "test", "--e2e", "--format=compact"],
    {
      cwd: dir,
      encoding: "utf8",
      env: { ...env, KEEL_TEST_TIME_SCALE: "1" },
      timeout: fixedTime(540_000),
      killSignal: "SIGKILL",
    },
  );
  out = `${r.stdout}\n${r.stderr}`;
  const at = join(dir, "reports", "tests", "e2e.json");
  report = existsSync(at) ? JSON.parse(readFileSync(at, "utf8")) : undefined;
  artifacts = existsSync(join(dir, "reports", "e2e")) ? readdirSync(join(dir, "reports", "e2e")).sort() : [];
}, fixedTime(600_000));
afterAll(() => {
  if (dir !== "") rmSync(dir, { recursive: true, force: true });
});

/** The states `e2e.json` records for `file`, by test line. */
function states(file: string): Map<number, string> {
  const files = typeof report === "object" && report !== null ? Reflect.get(report, "files") : undefined;
  const entry = typeof files === "object" && files !== null ? Reflect.get(files, file) : undefined;
  const tests: unknown = typeof entry === "object" && entry !== null ? Reflect.get(entry, "tests") : undefined;
  const map = new Map<number, string>();
  if (Array.isArray(tests))
    for (const t of tests) map.set(Number(Reflect.get(Object(t), "line")), String(Reflect.get(Object(t), "state")));
  return map;
}

/** The 1-based line of the `it` titled `title` in a fixture test file. */
function lineOf(file: string, title: string): number {
  return (
    readFileSync(join(FIXTURE, file), "utf8")
      .split("\n")
      .findIndex((l) => l.startsWith(`it("${title}"`)) + 1
  );
}

/** The T0001 block of `file` whose line is at or after `line`, with the indented lines under it. */
function block(file: string, line: number): string[] {
  const rows = out.split("\n");
  const at = rows.findIndex((r) => {
    const m = new RegExp(`^T0001 ${file.replace(/\./g, "\\.")}:(\\d+):`).exec(r);
    return m?.[1] !== undefined && Number(m[1]) >= line && Number(m[1]) < line + 12;
  });
  if (at < 0) return [];
  const lines = [rows[at] ?? ""];
  for (const r of rows.slice(at + 1)) {
    if (!r.startsWith("  ")) break;
    lines.push(r);
  }
  return lines;
}

describe("@keel/testing/e2e on a built app", () => {
  it.each([
    "fire resolves after the answer reached the page",
    "find of an absent id is E1705 and sends the browser nothing",
    "until of Live on Connecting is E1735 after 10.0s",
    "a held page keeps value caret and focus over resume, a replacing claim is E1720",
    "a boom the test reads",
    "stop and start keep the data; two serves share nothing",
    "page outside a library's folder is E1736",
  ])("passes: %s", (title) => {
    expect(states("test/page.e2e.ts").get(lineOf("test/page.e2e.ts", title)), out.slice(-3000)).toBe("passed");
  });

  it.each(["skill-testing", "skill-deploy"])("the %s example passes", (name) => {
    const tests = [...states(`test/${name}.e2e.ts`).values()];
    expect(tests, out.slice(-3000)).toEqual(["passed"]);
  });

  it("an until that runs out prints E1735 with the request it saw, a screenshot and a trace named after its line", () => {
    const line = lineOf("test/fail.e2e.ts", "an until that runs out");
    expect(states("test/fail.e2e.ts").get(line), out.slice(-3000)).toBe("failed");
    const [head = "", ...rest] = block("test/fail.e2e.ts", line);
    expect(head).toMatch(
      /^T0001 test\/fail\.e2e\.ts:(\d+):\d+ E1735 until a\.status: text was "Connecting", not "Live" after 1\.0s$/,
    );
    const at = /:(\d+):/.exec(head)?.[1] ?? "";
    expect(rest.filter((r) => r.startsWith("  server: ")).some((r) => r.includes("GET / "))).toBe(true);
    expect(rest.filter((r) => !r.startsWith("  server: "))).toEqual([
      `  screenshot: reports/e2e/fail.e2e-${at}-1.png`,
      `  trace: reports/e2e/fail.e2e-${at}-1.zip`,
    ]);
    expect(artifacts).toContain(`fail.e2e-${at}-1.png`);
    expect(artifacts).toContain(`fail.e2e-${at}-1.zip`);
  });

  it("two tabs of one context give two screenshots and one trace", () => {
    const rows = block("test/fail.e2e.ts", lineOf("test/fail.e2e.ts", "an until that runs out with two tabs"));
    expect(rows.filter((r) => r.startsWith("  screenshot: "))).toHaveLength(2);
    expect(rows.filter((r) => r.startsWith("  trace: "))).toHaveLength(1);
  });

  it("a browser problem the test never reads fails it with E1738 at the test's line", () => {
    const line = lineOf("test/fail.e2e.ts", "a boom the test never reads");
    expect(states("test/fail.e2e.ts").get(line)).toBe("failed");
    const [head = ""] = block("test/fail.e2e.ts", line);
    expect(head).toMatch(new RegExp(`^T0001 test/fail\\.e2e\\.ts:${line}:\\d+ E1738 pageerror Error: boom`));
  });
});
