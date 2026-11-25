import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isRecord } from "./isRecord.ts";

/** The `version` of the running `@keel/cli`: the nearest `package.json` above this module named `@keel/cli`. */
export function cliVersion(): string {
  for (let dir = dirname(fileURLToPath(import.meta.url)); dirname(dir) !== dir; dir = dirname(dir)) {
    let pkg: unknown;
    try {
      pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
    } catch {
      continue;
    }
    if (isRecord(pkg) && pkg.name === "@keel/cli" && typeof pkg.version === "string") return pkg.version;
  }
  return "0.0.0";
}
