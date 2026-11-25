// Support for the ledger tests over in-memory files: the run report a passing run would write (k.test-run Run
// report; k.ledger-items Run evidence). Not a test file.
import { createHash } from "node:crypto";
import { TEST_FILE } from "../src/internal/TEST_FILE.ts";
import { ledgerProjects } from "../src/internal/ledgerProjects.ts";
import { projectOf } from "../src/internal/projectOf.ts";
import { testFacts } from "../src/internal/testFacts.ts";
import type { SourceFile } from "../src/types/SourceFile.ts";

const REPORTS = /(?:^|\/)reports\//;
const FOLDER = /^((?:packages|apps|examples)\/[^/]+)\//;

/**
 * `given` with a `package.json` in each `packages/<p>`, `apps/<a>` and `examples/<e>` that lacks one, so each is a
 * project, and one `reports/tests/run.json` per project (`ledgerProjects`) that holds test files, saying each
 * non-skipped test of each test file passed at its call's first line, at the file's source as given.
 */
export function runReported(given: readonly SourceFile[]): SourceFile[] {
  const have = new Set(given.map((f) => f.path));
  const dirs = new Set(given.flatMap((f) => FOLDER.exec(f.path)?.[1] ?? []));
  const manifests = [...dirs]
    .filter((d) => !have.has(`${d}/package.json`))
    .map((d) => ({
      path: `${d}/package.json`,
      source: `${JSON.stringify({ name: d.split("/")[1], private: true })}\n`,
    }));
  const files = [...given, ...manifests];
  const projects = ledgerProjects(files);
  const byProject = new Map<string, Record<string, { sha: string; tests: { line: number; state: "passed" }[] }>>();
  for (const f of files) {
    if (!TEST_FILE.test(f.path) || REPORTS.test(f.path)) continue;
    const project = projectOf(f.path, projects);
    const path = project === "." ? f.path : f.path.slice(project.length + 1);
    const tests = testFacts(f.path, f.source).tests.map((t): { line: number; state: "passed" } => ({
      line: t.from,
      state: "passed",
    }));
    const sha = createHash("sha256").update(f.source).digest("hex");
    byProject.set(project, { ...(byProject.get(project) ?? {}), [path]: { sha, tests } });
  }
  const reports = [...byProject].map(([project, entries]) => ({
    path: `${project === "." ? "" : `${project}/`}reports/tests/run.json`,
    source: `${JSON.stringify({ v: 1, files: entries }, null, 2)}\n`,
  }));
  return [...files, ...reports];
}
