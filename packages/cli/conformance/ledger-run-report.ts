// Support for the `keel ledger` conformance tests whose fixture expects a rung: the run report of the fixture's tests
// (k.test-run Run report, `reports/tests/run.json`; k.ledger-items Run evidence). Not a test file.
// A fixture that builds a project and expects a rung holds a report saying its tests passed, read at the call's first line.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

export type ReportedState = "passed" | "failed" | "skipped";
export type ReportedTest = { line: number; state: ReportedState };

/** SHA-256 hex of a file's source, as the run report's `sha` (k.test-run Run report). */
export const sha256 = (source: string): string => createHash("sha256").update(source).digest("hex");

const CALL = /^\s*(?:it|test)(?:\.[A-Za-z]+)*[\s(]/;
const SKIPPED = /^\s*(?:it|test)(?:\.[A-Za-z]+)*\.(?:skip|todo)\b/;

/** The tests of a test file's source as a run reports them: each line that opens an `it` or `test` call, 1-based. */
export function testsOf(source: string, state: (line: string) => ReportedState = defaultState): ReportedTest[] {
  const out: ReportedTest[] = [];
  source.split("\n").forEach((text, i) => {
    if (CALL.test(text)) out.push({ line: i + 1, state: state(text) });
  });
  return out;
}
const defaultState = (line: string): ReportedState => (SKIPPED.test(line) ? "skipped" : "passed");

const isTestFile = (name: string): boolean => /\.test(?:-d)?\.tsx?$/.test(name);

function walk(dir: string, out: string[]): void {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === "reports" || e.name === ".keel") continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (isTestFile(e.name)) out.push(p);
  }
}

/** The projects of a folder (k.ledger-items Projects): `.` and each `packages/<p>`, `apps/<a>`, `examples/<e>` with a `package.json`. */
export function projectsOf(dir: string): string[] {
  const out = ["."];
  for (const group of ["packages", "apps", "examples"]) {
    if (!existsSync(join(dir, group))) continue;
    for (const e of readdirSync(join(dir, group), { withFileTypes: true })) {
      if (e.isDirectory() && existsSync(join(dir, group, e.name, "package.json"))) out.push(`${group}/${e.name}`);
    }
  }
  return out;
}

/**
 * Write `reports/tests/run.json` into each project of `dir` that holds test files, saying each test passed
 * (skipped for `it.skip`) at the sources as they are now. A folder under `packages/` that holds files and no
 * `package.json` gets `{ "name": <folder>, "private": true }`, so it is a project.
 */
export function writeRunReports(dir: string): void {
  if (existsSync(join(dir, "packages"))) {
    for (const e of readdirSync(join(dir, "packages"), { withFileTypes: true })) {
      const manifest = join(dir, "packages", e.name, "package.json");
      if (e.isDirectory() && !existsSync(manifest)) {
        writeFileSync(manifest, `${JSON.stringify({ name: e.name, private: true }, null, 2)}\n`);
      }
    }
  }
  const projects = projectsOf(dir);
  const files = new Map<string, Record<string, { sha: string; tests: ReportedTest[] }>>();
  const all: string[] = [];
  walk(dir, all);
  for (const file of all) {
    const rel = relative(dir, file);
    const owner = projects
      .filter((p) => p === "." || rel.startsWith(`${p}/`))
      .reduce((a, b) => (b.length > a.length ? b : a), ".");
    const path = owner === "." ? rel : rel.slice(owner.length + 1);
    const source = readFileSync(file, "utf8");
    const entry = files.get(owner) ?? {};
    entry[path] = { sha: sha256(source), tests: testsOf(source) };
    files.set(owner, entry);
  }
  for (const [project, entries] of files) {
    const folder = join(dir, project, "reports", "tests");
    mkdirSync(folder, { recursive: true });
    writeFileSync(join(folder, "run.json"), `${JSON.stringify({ v: 1, files: entries }, null, 2)}\n`);
  }
}
