import { existsSync, readdirSync, realpathSync } from "node:fs";
import { sha256Hex } from "../sha256Hex.ts";
import type { CacheProbe } from "./CacheProbe.ts";

const hash = (names: readonly string[]): string => sha256Hex(new TextEncoder().encode([...names].sort().join("\n")));

/** The answer `kind`'s question about `path` gets now (`CacheProbe`), asked of the file system and `process.env`. */
export function probeAnswer(kind: CacheProbe["kind"], path: string): string | null {
  try {
    if (kind === "exists") return existsSync(path) ? "yes" : "no";
    if (kind === "realpath") return realpathSync(path);
    if (kind === "list") return hash(readdirSync(path));
    if (kind === "env") return process.env[path] ?? null;
    return hash(Object.keys(process.env));
  } catch {
    return null;
  }
}
