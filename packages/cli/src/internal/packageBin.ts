import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { isRecord } from "./isRecord.ts";

/**
 * The real path of the executable `bin` of the package `pkg` installed for `dir`: the nearest `node_modules/<pkg>` at
 * or above it, its `package.json` `bin` entry, resolved through links. A launcher in `node_modules/.bin` finds its
 * package by a path relative to itself, which breaks when `node_modules` is a link from elsewhere; this path does not.
 * Undefined when the package is not installed there or declares no such `bin`.
 */
export function packageBin(dir: string, pkg: string, bin: string): string | undefined {
  for (let at = resolve(dir); ; at = dirname(at)) {
    const manifest = join(at, "node_modules", pkg, "package.json");
    if (existsSync(manifest)) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(readFileSync(manifest, "utf8"));
      } catch {
        return undefined;
      }
      const entry = isRecord(parsed) ? parsed.bin : undefined;
      const rel = typeof entry === "string" ? entry : isRecord(entry) ? entry[bin] : undefined;
      if (typeof rel !== "string") return undefined;
      const file = join(dirname(realpathSync(manifest)), rel);
      return existsSync(file) ? realpathSync(file) : undefined;
    }
    if (dirname(at) === at) return undefined;
  }
}
