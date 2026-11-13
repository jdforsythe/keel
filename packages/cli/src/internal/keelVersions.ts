import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { isRecord } from "./isRecord.ts";

/** Binary only: each `@keel/*` package installed at `cwd` (`node_modules/@keel`) by name, with its version. */
export function keelVersions(cwd: string): Record<string, string> {
  const at = join(cwd, "node_modules", "@keel");
  let names: string[] = [];
  try {
    names = readdirSync(at).sort();
  } catch {
    return {};
  }
  const out: Record<string, string> = {};
  for (const name of names) {
    try {
      const pkg: unknown = JSON.parse(readFileSync(join(at, name, "package.json"), "utf8"));
      if (isRecord(pkg) && typeof pkg.name === "string" && typeof pkg.version === "string") out[pkg.name] = pkg.version;
    } catch {
      // not a package directory
    }
  }
  return out;
}
