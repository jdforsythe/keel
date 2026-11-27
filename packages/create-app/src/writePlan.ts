import { existsSync, mkdirSync, rmSync, rmdirSync } from "node:fs";
import { type FileHandle, open } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { MARKER } from "@keel/scaffold/create";
import { linkEscapes } from "@keel/scaffold/links";
import type { Stop } from "./Stop.ts";
import { realOf } from "./realOf.ts";

/** Lets the event loop run, so a SIGINT or SIGTERM that arrived during the last write reaches its handler. */
const turn = (): Promise<void> => new Promise((done) => setImmediate(done));
const codeOf = (e: unknown): string =>
  e instanceof Error && "code" in e && typeof e.code === "string" ? e.code : "an error";

/**
 * Writes `files` (keyed from the folder) under `abs`, all or nothing (k.create-folder Folder): every target is judged
 * first as k.scaffold Links says (`{ linked }`, E1357, nothing written); then `.keel-create` (`MARKER`) is created,
 * listing every path, each folder is made and each file created only where nothing is (`wx`), never replaced, and the
 * marker is removed last. The writes are asynchronous, so a signal is handled while one is in flight. A write that
 * fails (`{ failed }`, E1365), or a signal (`{ stopped }`, E1367) that `interrupted` settles with during a write or
 * `stopped` reports between two, removes the files and folders this run made, in reverse, the marker last; a file whose
 * creation was still in flight is removed when it settles. A kill no handler sees leaves the marker, which the next
 * run names (E1366). `written` is told each path after its write (a test seam).
 */
export async function writePlan(
  abs: string,
  files: ReadonlyMap<string, string>,
  seams: {
    readonly stopped?: (() => Stop | undefined) | undefined;
    readonly interrupted?: Promise<Stop> | undefined;
    readonly written?: ((path: string) => void) | undefined;
  } = {},
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
      return { failed: ".", reason: codeOf(e) };
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
  const never = new Promise<never>(() => {});
  const interrupted = (seams.interrupted ?? never).then((stop) => ({ stop }));
  /** Creates `target` only where nothing is and writes `text`; the file is this run's from the moment it exists. */
  const create = async (target: string, text: string): Promise<void> => {
    let handle: FileHandle | undefined;
    try {
      handle = await open(target, "wx");
      madeFiles.push(target);
      await handle.writeFile(text);
    } finally {
      await handle?.close();
    }
  };
  for (const [p, target, text] of steps) {
    let writing: Promise<void>;
    try {
      mkdirs(dirname(target));
      writing = create(target, text);
    } catch (e) {
      undo();
      return { failed: p, reason: codeOf(e) };
    }
    const outcome = await Promise.race([
      writing.then(
        () => ({ done: true }),
        (e: unknown) => ({ reason: codeOf(e) }),
      ),
      interrupted,
    ]);
    if ("stop" in outcome) {
      undo();
      // The creation in flight may settle after the undo: its file is removed then.
      void writing.then(
        () => rmSync(target, { force: true }),
        () => undefined,
      );
      return { stopped: outcome.stop };
    }
    if ("reason" in outcome) {
      undo();
      return { failed: p, reason: outcome.reason };
    }
    if (p !== MARKER) seams.written?.(p);
    await turn();
    const signal = seams.stopped?.();
    if (signal !== undefined) {
      undo();
      return { stopped: signal };
    }
  }
  rmSync(marker, { force: true });
  return { ok: true };
}
