import type { OutRecord } from "@keel/cli";

/** The records of a `--format=json` run's NDJSON stdout: each line that parses to an object with a string `kind`. */
export function recordsOf(stdout: string): OutRecord[] {
  const out: OutRecord[] = [];
  for (const line of stdout.split("\n")) {
    if (line.trim() === "") continue;
    let v: unknown;
    try {
      v = JSON.parse(line);
    } catch {
      continue;
    }
    if (typeof v !== "object" || v === null || !("kind" in v) || typeof v.kind !== "string") continue;
    const rec: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) rec[k] = x;
    out.push({ ...rec, kind: v.kind });
  }
  return out;
}
