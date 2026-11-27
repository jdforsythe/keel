import type { CacheInput } from "./CacheInput.ts";
import type { CacheProbe } from "./CacheProbe.ts";
import { hashFile } from "./hashFile.ts";
import { probeAnswer } from "./probeAnswer.ts";

/**
 * Whether every recorded input, read again at its path, has the same SHA-256 and every recorded probe, asked again,
 * gets the same answer (k.derived Derivation cache); modification times are never read.
 */
export function cacheHeld(inputs: readonly CacheInput[], probes: readonly CacheProbe[]): boolean {
  return (
    inputs.every((i) => hashFile(i.file) === i.sha256) && probes.every((p) => probeAnswer(p.kind, p.path) === p.answer)
  );
}
