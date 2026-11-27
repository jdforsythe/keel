import { existsSync, mkdirSync, realpathSync, rmSync, rmdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { MARKER } from "@keel/scaffold/create";
import { linkEscapes } from "@keel/scaffold/links";
import { realOf } from "./realOf.ts";

/** A signal the process caught, which stops the writes. */
export type Stop = "SIGINT" | "SIGTERM";

/** Lets the event loop run, so a SIGINT or SIGTERM that arrived during the last write reaches its handler. */
const turn = (): Promise<void> => new Promise((done) => setImmediate(done));

/**
 * Writes `files` (keyed from the folder) under `abs`, all or nothing (k.create-folder Folder): every target is judged
 * first as k.scaffold Links says (`{ linked }`, E1357, nothing written); then `.keel-create` (`MARKER`) is created,
 * listing every path, each folder is made and each file created only where nothing is (`wx`), never replaced, and the
 * marker is removed last. A write that fails (`{ failed }`, E1365) or a signal `stopped` reports between two writes
 * (`{ stopped }`, E1367) removes the files and folders this run made, in reverse, the marker last; a kill no handler
 * sees leaves the marker, which the next run names (E1366). `written` is told each path after its write (a test seam).
 */
export async function writePlan(
  abs: string,
  files: ReadonlyMap<string, string>,
  stopped: () => Stop | undefined = () => undefined,
  written: (path: string) => void = () => undefined,
): Promise<
  | { readonly ok: true }
  | { readonly linked: string }
  | { readonly failed: string; readonly reason: string }
  | { readonly stopped: Stop }
> {
  const paths = [...files.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  // A folder this run makes holds no link, so only an existing one is judged; its ancestors are never read.
  const fresh = !existsSync(abs);
  if (!fresh) {
    const real = realOf(abs);
    const linked = [MARKER, ...paths].find((p) => linkEscapes(real, join(real, p)));
    if (linked !== undefined) return { linked };
  }
  const madeDirs: string[] = [];
  const madeFiles: string[] = [];
  const undo = (): void => {
    for (const f of madeFiles.reverse()) rmSync(f, { force: true });
    for (const d of madeDirs.reverse()) {
      try {
        rmdirSync(d);
      } catch {
        // not empty: something else wrote into it, so it is not this run's to remove
      }
    }
  };
  if (fresh) {
    try {
      const top = mkdirSync(abs, { recursive: true });
      for (let at = abs; top !== undefined; at = dirname(at)) {
        madeDirs.unshift(at);
        if (at === top || dirname(at) === at) break;
      }
    } catch (e) {
      return {
        failed: ".",
        reason: e instanceof Error && "code" in e && typeof e.code === "string" ? e.code : "an error",
      };
    }
  }
  /** The folders under `abs` on the way to `dir` that do not exist yet, made in order. */
  const mkdirs = (dir: string): void => {
    const missing: string[] = [];
    for (let at = dir; at !== abs && !existsSync(at); at = dirname(at)) missing.unshift(at);
    for (const d of missing) {
      mkdirSync(d);
      madeDirs.push(d);
    }
  };
  const marker = join(abs, MARKER);
  const steps: readonly (readonly [string, string, string])[] = [
    [MARKER, marker, `${paths.join("\n")}\n`],
    ...paths.map((p): readonly [string, string, string] => [p, join(abs, p), files.get(p) ?? ""]),
  ];
  for (const [p, target, text] of steps) {
    try {
      mkdirs(dirname(target));
      writeFileSync(target, text, { flag: "wx" });
      madeFiles.push(target);
    } catch (e) {
      undo();
      const code = e instanceof Error && "code" in e && typeof e.code === "string" ? e.code : "an error";
      return { failed: p, reason: code };
    }
    if (p !== MARKER) written(p);
    await turn();
    const signal = stopped();
    if (signal !== undefined) {
      undo();
      return { stopped: signal };
    }
  }
  rmSync(marker, { force: true });
  return { ok: true };
}
