import type { CacheProbe } from "./CacheProbe.ts";
import type { Evaluation } from "./Evaluation.ts";
import { hashFile } from "./hashFile.ts";
import { probeAnswer } from "./probeAnswer.ts";

/**
 * The recorded probes of an evaluation (k.derived Derivation cache), each answered now (`probeAnswer`), sorted: every
 * question its code asked of the file system (each symbolic link on a path to a file it loaded or read, and each
 * `node_modules/<name>` its bare imports resolved through, a `realpath` one), each file it read that cannot be read
 * (an `exists` one), each `process.env` name it read with the value it saw, and the environment's names when it
 * listed them.
 */
export function cacheProbes(e: Evaluation): CacheProbe[] {
  const out = new Map<string, CacheProbe>();
  const add = (kind: CacheProbe["kind"], path: string, answer: string | null): void => {
    if (!out.has(`${kind}\0${path}`)) out.set(`${kind}\0${path}`, { kind, path, answer });
  };
  for (const [kind, path] of e.probes) add(kind, path, probeAnswer(kind, path));
  for (const file of e.reads) if (hashFile(file) === undefined) add("exists", file, probeAnswer("exists", file));
  for (const [name, value] of e.env) add("env", name, value);
  if (e.envListed) add("env-names", "", probeAnswer("env-names", ""));
  return [...out.values()].sort((a, b) =>
    a.kind === b.kind ? (a.path < b.path ? -1 : a.path > b.path ? 1 : 0) : a.kind < b.kind ? -1 : 1,
  );
}
