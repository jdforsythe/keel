import ts from "typescript";
import type { Probe } from "./Probe.ts";
import { diskText } from "./diskText.ts";
import { listHash } from "./listHash.ts";

/**
 * The file system as the type pass sees it, each question recorded with its answer (k.check-cache Probes): the
 * answers `askDisk` gives again for an unchanged disk. `probes()` is `undefined` when one question got two answers
 * within the pass (the disk changed under it), so no entry is kept for that pass.
 */
export function probeRecorder() {
  const seen = new Map<string, Probe>();
  let torn = false;
  const note = (kind: Probe[0], question: string, answer: string): void => {
    const at = `${kind}\u0000${question}`;
    const was = seen.get(at);
    if (was === undefined) seen.set(at, [kind, question, answer]);
    else if (was[2] !== answer) torn = true;
  };
  const realpath = ts.sys.realpath;
  return {
    read(fileName: string): string | undefined {
      const got = diskText(fileName);
      note("r", fileName, got?.hash ?? "-");
      return got?.text;
    },
    fileExists(fileName: string): boolean {
      const yes = ts.sys.fileExists(fileName);
      note("f", fileName, yes ? "1" : "0");
      return yes;
    },
    directoryExists(dir: string): boolean {
      const yes = ts.sys.directoryExists(dir);
      note("d", dir, yes ? "1" : "0");
      return yes;
    },
    realpath:
      realpath === undefined
        ? undefined
        : (p: string): string => {
            const target = realpath(p);
            note("p", p, target);
            return target;
          },
    getDirectories(dir: string): string[] {
      const names = ts.sys.getDirectories(dir);
      note("l", dir, listHash(names));
      return names;
    },
    readDirectory(
      dir: string,
      extensions: readonly string[],
      excludes: readonly string[] | undefined,
      includes: readonly string[],
      depth?: number,
    ): string[] {
      const found = ts.sys.readDirectory(dir, extensions, excludes, includes, depth);
      note("x", JSON.stringify([dir, extensions, excludes ?? null, includes, depth ?? null]), listHash(found));
      return found;
    },
    probes(): readonly Probe[] | undefined {
      return torn ? undefined : [...seen.values()];
    },
  };
}
