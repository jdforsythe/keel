import { readdirSync } from "node:fs";
import { dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { cliVersion } from "../cliVersion.ts";
import { sha256Hex } from "../sha256Hex.ts";
import { hashFile } from "./hashFile.ts";

/** The entry format; a change of it is a miss for every older entry. */
const FORMAT = 3;
let keel: string | undefined;

/**
 * The SHA-256 of the evaluator's own code: the CLI's version and each file that evaluates, the compiler's internal
 * folder (the bundle's views and resolver) whole (k.derived Derivation cache).
 */
function keelKey(): string {
  if (keel !== undefined) return keel;
  const own = dirname(fileURLToPath(import.meta.url));
  const views = fileURLToPath(import.meta.resolve("@keel/compiler/routes"));
  const ext = views.slice(views.lastIndexOf("."));
  const files = [
    ...readdirSync(own)
      .filter((n) => n.endsWith(ext))
      .sort()
      .map((n) => join(own, n)),
    views,
    ...readdirSync(join(dirname(views), "internal"))
      .filter((n) => n.endsWith(ext))
      .sort()
      .map((n) => join(dirname(views), "internal", n)),
    join(own, "..", `surfaceOf${ext}`),
    join(own, "..", `toJsonSchema${ext}`),
  ];
  const texts = files.map((f) => `${f.slice(f.lastIndexOf(sep) + 1)}:${hashFile(f) ?? "-"}`);
  keel = sha256Hex(new TextEncoder().encode(`${cliVersion()}\n${texts.join("\n")}`));
  return keel;
}

/**
 * The key of a project's entry (k.derived Derivation cache): the format, the Keel version and code, the project's real
 * root (an entry copied with its folder to another tree is a miss there) and its code file paths.
 */
export function cacheKey(root: string, paths: readonly string[]): string {
  return JSON.stringify({ format: FORMAT, keel: keelKey(), root, paths });
}
