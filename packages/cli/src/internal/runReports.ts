import { createHash } from "node:crypto";
import type { SourceFile } from "../types/SourceFile.ts";
import type { Diag } from "./Diag.ts";
import { isRecord } from "./isRecord.ts";
import { makeDiag } from "./makeDiag.ts";
import { projectOf } from "./projectOf.ts";

type Reported = { readonly line: number; readonly state: string };
type Entry = { readonly sha: string; readonly tests: readonly Reported[] };

const REPORT = /^(?:((?:packages|apps|examples)\/[^/]+)\/)?reports\/tests\/[^/]+\.json$/;
const sha256 = (text: string): string => createHash("sha256").update(text).digest("hex");

const parse = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

/** A report's entries (k.test-run Run report), by path relative to its project; a file of another shape holds none. */
function entriesOf(source: string): Map<string, Entry> {
  const out = new Map<string, Entry>();
  const doc = parse(source);
  if (!isRecord(doc) || doc.v !== 1 || !isRecord(doc.files)) return out;
  for (const [path, e] of Object.entries(doc.files)) {
    if (!isRecord(e) || typeof e.sha !== "string" || !Array.isArray(e.tests)) continue;
    const tests = e.tests.flatMap((t: unknown) =>
      isRecord(t) && typeof t.line === "number" && typeof t.state === "string"
        ? [{ line: t.line, state: t.state }]
        : [],
    );
    out.set(path, { sha: e.sha, tests });
  }
  return out;
}

/**
 * Run evidence (k.ledger-items Run evidence) over the run reports among `files` (`<project>/reports/tests/*.json`):
 * an entry counts in the report of the project whose file it is (`projectOf`), never another's.
 * `passes(path, from, to)` is true when the test of `path` (from the ledger's folder) whose call spans lines `from` to
 * `to` is passing: its project's reports hold the file once, at the `sha` of its source in `files`, with at least one
 * test `passed` and none `failed` at a line in that span. Per project of `projects` with a file of `tests` (the test
 * files the ledger reads) that no report holds, that a report holds at another `sha`, or that two report files hold,
 * one W1733 at `<project>/reports/tests/` naming how many and the first by path.
 */
export function runReports(
  files: readonly SourceFile[],
  projects: readonly string[],
  tests: readonly string[],
): { readonly passes: (path: string, from: number, to: number) => boolean; readonly diags: readonly Diag[] } {
  const held = new Map<string, Entry[]>();
  for (const f of files) {
    const m = REPORT.exec(f.path);
    if (m === null) continue;
    const prefix = m[1] === undefined ? "" : `${m[1]}/`;
    const project = m[1] ?? ".";
    if (!projects.includes(project)) continue;
    for (const [path, e] of entriesOf(f.source)) {
      const key = `${prefix}${path}`;
      // A report speaks for its own project's files: a root run's entry for `packages/p/...` is not `packages/p`'s.
      if (projectOf(key, projects) !== project) continue;
      held.set(key, [...(held.get(key) ?? []), e]);
    }
  }
  const source = new Map(files.map((f) => [f.path, f.source]));
  const fresh = new Map<string, Entry>();
  const unusable = new Map<string, string[]>();
  for (const path of [...new Set(tests)].sort()) {
    const text = source.get(path);
    const at = held.get(path) ?? [];
    const only = at.length === 1 ? at[0] : undefined;
    if (text !== undefined && only !== undefined && only.sha === sha256(text)) {
      fresh.set(path, only);
      continue;
    }
    const project = projectOf(path, projects);
    unusable.set(project, [...(unusable.get(project) ?? []), project === "." ? path : path.slice(project.length + 1)]);
  }
  const diags = [...unusable].map(([project, paths]) =>
    makeDiag(
      "W1733",
      `no usable run report for ${paths.length} test ${paths.length === 1 ? "file" : "files"}; first ${paths[0] ?? ""}`,
      { path: project === "." ? "reports/tests/" : `${project}/reports/tests/`, see: "k.ledger-items" },
    ),
  );
  const passes = (path: string, from: number, to: number): boolean => {
    const run = fresh.get(path)?.tests.filter((t) => t.line >= from && t.line <= to) ?? [];
    return run.some((t) => t.state === "passed") && !run.some((t) => t.state === "failed");
  };
  return { passes, diags };
}
