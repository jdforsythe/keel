import type { Issue } from "./Issue.ts";

const FORBIDDEN = new Set(["__proto__", "constructor", "prototype"]);

/** Issues for string-entry keys naming a prototype key at any dotted depth; the path is that of the object carrying it. */
export function protoPaths(keys: Iterable<string>): Issue[] {
  const seen = new Set<string>();
  const issues: Issue[] = [];
  for (const key of keys) {
    const parts = key.replace(/\[\]$/, "").split(".");
    const at = parts.findIndex((p) => FORBIDDEN.has(p));
    if (at < 0) continue;
    const path = parts.slice(0, at);
    const id = JSON.stringify(path);
    if (!seen.has(id)) {
      seen.add(id);
      issues.push({ path, rule: "type" });
    }
  }
  return issues;
}
