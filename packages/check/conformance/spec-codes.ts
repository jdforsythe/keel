// Not a test file. The E codes named in the Rules paragraph of every spec/kernel/*.md section, read at test time.
import { readFileSync, readdirSync } from "node:fs";

const DIR = new URL("../../../spec/kernel/", import.meta.url);

/** Sorted, de-duplicated E codes cited by any `**Rules` paragraph of a kernel section. */
export function specCodes(): string[] {
  const codes = new Set<string>();
  for (const name of readdirSync(DIR).filter((n) => n.endsWith(".md"))) {
    const lines = readFileSync(new URL(name, DIR), "utf8").split("\n");
    let inRules = false;
    for (const line of lines) {
      if (line.startsWith("**Rules")) inRules = true;
      else if (line.trim() === "") inRules = false;
      if (inRules) for (const m of line.matchAll(/\bE\d{4}\b/g)) codes.add(m[0]);
    }
  }
  return [...codes].sort();
}
