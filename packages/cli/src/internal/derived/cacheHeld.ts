import { isAbsolute, sep } from "node:path";
import { realPaths } from "../realPaths.ts";
import type { CacheInput } from "./CacheInput.ts";
import type { CacheProbe } from "./CacheProbe.ts";
import { hashFile } from "./hashFile.ts";
import { probeAnswer } from "./probeAnswer.ts";

/**
 * A file of the project itself, named by its path from the project (`cacheInputs`): an edit reaches these first, so
 * they are read before the packages' files.
 */
const own = (i: CacheInput): boolean =>
  !isAbsolute(i.path) &&
  i.file.split(sep).join("/").endsWith(`/${i.path}`) &&
  !i.file.split(sep).includes("node_modules");

/**
 * Whether every recorded input, read again at its path, has the same SHA-256 and every recorded probe, asked again,
 * gets the same answer (k.derived Derivation cache); an unchanged settled file's digest is the one `hashFile` kept,
 * never one judged by its modification time alone. The project's
 * own inputs are read first, so an entry an edit made stale is told after those alone.
 */
export function cacheHeld(inputs: readonly CacheInput[], probes: readonly CacheProbe[]): boolean {
  const realOf = realPaths();
  return (
    [...inputs.filter(own), ...inputs.filter((i) => !own(i))].every((i) => hashFile(i.file) === i.sha256) &&
    probes.every((p) => probeAnswer(p.kind, p.path, realOf) === p.answer)
  );
}
