import type { Diag } from "./Diag.ts";
import type { TestTally } from "./TestTally.ts";
import { isRecord } from "./isRecord.ts";
import { makeDiag } from "./makeDiag.ts";
import { relPath } from "./relPath.ts";

const ESC = String.fromCharCode(27);
const strip = (s: string): string => s.split(new RegExp(`${ESC}\\[[0-9;]*m`)).join("");
const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
const firstLine = (s: string): string => strip(s).split("\n")[0] ?? "";

/** The first app frame of a vitest error: `{ file, line, col }` outside node_modules and vitest itself. */
const frame = (err: Readonly<Record<string, unknown>>): { file: string; line: number; col: number } | undefined => {
  const stacks = Array.isArray(err.stacks) ? err.stacks : [];
  for (const f of stacks) {
    if (!isRecord(f)) continue;
    const file = str(f.file);
    if (file === undefined || file.includes("node_modules") || file.includes("/vitest/")) continue;
    return { file, line: typeof f.line === "number" ? f.line : 1, col: typeof f.column === "number" ? f.column : 1 };
  }
  return undefined;
};

/**
 * Walk vitest's finished task tree (same shape KeelReporter reads) into T0001 diagnostics and counts:
 * one diagnostic per failed test at its first app frame, relative to `cwd`.
 */
export function collectResults(cwd: string, files: readonly unknown[], errors: readonly unknown[]): TestTally {
  const tally: TestTally = { diags: [], tests: 0, failed: 0, skipped: 0 };
  const walk = (node: unknown, file: string, trail: readonly string[]): void => {
    if (!isRecord(node)) return;
    const name = [...trail, str(node.name) ?? ""].filter((n) => n !== "");
    const result = isRecord(node.result) ? node.result : {};
    if (node.type === "test" || node.type === "custom") {
      tally.tests++;
      const state = str(result.state);
      if (state === "fail") {
        tally.failed++;
        const errs = Array.isArray(result.errors) ? result.errors : [];
        const err: unknown = errs[0];
        const e = isRecord(err) ? err : {};
        const at = frame(e);
        const d: Diag = makeDiag("T0001", `${name.join(" > ")}: ${firstLine(str(e.message) ?? "test failed")}`, {
          path: relPath(cwd, at?.file ?? file),
          line: at?.line ?? 1,
          col: at?.col ?? 1,
        });
        tally.diags.push(d);
      } else if (state === "skip" || state === "todo" || node.mode === "skip" || node.mode === "todo") tally.skipped++;
    }
    const tasks = Array.isArray(node.tasks) ? node.tasks : [];
    for (const t of tasks) walk(t, file, name);
  };
  for (const f of files) {
    if (!isRecord(f)) continue;
    const fileOf = isRecord(f.file) ? str(f.file.filepath) : undefined;
    const path = fileOf ?? str(f.filepath) ?? str(f.name) ?? "";
    const tasks = Array.isArray(f.tasks) ? f.tasks : [];
    const before = tally.failed;
    for (const t of tasks) walk(t, path, []);
    const result = isRecord(f.result) ? f.result : {};
    if (result.state === "fail" && tally.failed === before) {
      tally.failed++;
      const errs = Array.isArray(result.errors) ? result.errors : [];
      const err: unknown = errs[0];
      const msg = isRecord(err) ? (str(err.message) ?? "file failed to run") : "file failed to run";
      tally.diags.push(makeDiag("T0001", firstLine(msg), { path: relPath(cwd, path), line: 1, col: 1 }));
    }
  }
  for (const e of errors) {
    const msg = isRecord(e) ? (str(e.message) ?? "unhandled error") : String(e);
    tally.diags.push(makeDiag("T0001", firstLine(msg)));
    tally.failed++;
  }
  return tally;
}
