import type { A11yCase } from "@keel/testing/a11y";
import { isRecord } from "./isRecord.ts";
import { relPath } from "./relPath.ts";

/**
 * Every test of vitest's file tasks as `writeA11yReport` reads it (k.a11y Claims): its file relative to `root`, its
 * full name (suites and its own name, joined by spaces), whether it passed, and its `meta`, where the harness keeps
 * the test's render checks.
 */
export function a11yCases(files: readonly unknown[], root: string): A11yCase[] {
  const out: A11yCase[] = [];
  const walk = (task: unknown, file: string, names: readonly string[]): void => {
    if (!isRecord(task)) return;
    const name = typeof task.name === "string" ? task.name : "";
    if (task.type === "test") {
      const result = isRecord(task.result) ? task.result : {};
      out.push({ file, test: [...names, name].join(" "), passed: result.state === "pass", meta: task.meta });
      return;
    }
    if (Array.isArray(task.tasks)) for (const t of task.tasks) walk(t, file, [...names, name]);
  };
  for (const f of files) {
    if (!isRecord(f) || typeof f.filepath !== "string" || !Array.isArray(f.tasks)) continue;
    const file = relPath(root, f.filepath);
    for (const t of f.tasks) walk(t, file, []);
  }
  return out;
}
