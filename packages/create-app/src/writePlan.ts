import { closeSync, existsSync, mkdirSync, openSync, rmSync, rmdirSync } from "node:fs";
import { writeFile } from "node:fs/promises";
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
 * listing every file, then every folder inside `abs` the run makes (`/`-ended, deepest first), each folder is made and each file created only where nothing is (`wx`), never replaced, and the
 * marker is removed last. The writes are asynchronous, so a signal is handled while one is in flight. A write that
 * fails (`{ failed }`, E1365), or a signal (`{ stopped }`, E1367) that `interrupted` settles with during a write or
 * `stopped` reports between two, removes the files this run made, then the folders it made inside the folder, then
 * the marker, then the folder and the folders above it that it made, all synchronously before the promise settles; a
 * file is created synchronously before its text is written, and that write cannot create it again, so a caller that
 * exits then leaves nothing behind, whether or not the write in flight ever settles. A kill no
 * handler sees leaves the marker, which the next run names (E1366). `written` is told each path after its write (a
 * test seam).
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
  /** The folder and the folders above it that this run made, outermost first. */
  const madeOuter: string[] = [];
  /** The folders inside the folder that this run made, in the order made. */
  const madeInner: string[] = [];
  const madeFiles: string[] = [];
  const marker = join(abs, MARKER);
  const rmdirOwn = (d: string): void => {
    try {
      rmdirSync(d);
    } catch {
      // not empty: something else wrote into it, so it is not this run's to remove
    }
  };
  /** Removes what this run made: files, then the folders inside, then the marker, then the folder and those above. */
  const undo = (): void => {
    for (const f of [...madeFiles].reverse()) if (f !== marker) rmSync(f, { force: true });
    for (const d of [...madeInner].reverse()) rmdirOwn(d);
    if (madeFiles.includes(marker)) rmSync(marker, { force: true });
    for (const d of [...madeOuter].reverse()) rmdirOwn(d);
  };
  const before = seams.stopped?.();
  if (before !== undefined) return { stopped: before };
  if (fresh) {
    try {
      const top = mkdirSync(abs, { recursive: true });
      for (let at = abs; top !== undefined; at = dirname(at)) {
        madeOuter.unshift(at);
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
      madeInner.push(d);
    }
  };
  // Every folder under `abs` this run will make, `/`-ended, deepest first: listed after the files, so removing what the
  // marker lists in order (files, then folders, each once empty) leaves the folder as it was (k.create-folder Folder).
  const folders = new Set<string>();
  for (const p of paths)
    for (let at = dirname(p); at !== "." && !existsSync(join(abs, at)); at = dirname(at)) folders.add(`${at}/`);
  const listed = [...paths, ...[...folders].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0))];
  const steps: readonly (readonly [string, string, string])[] = [
    [MARKER, marker, `${listed.join("\n")}\n`],
    ...paths.map((p): readonly [string, string, string] => [p, join(abs, p), files.get(p) ?? ""]),
  ];
  const never = new Promise<never>(() => {});
  const interrupted = (seams.interrupted ?? never).then((stop) => ({ stop }));
  /**
   * Creates `target` only where nothing is, at once (`wx`, synchronous), so the file is in `madeFiles` before any
   * signal can be handled; then writes `text` into it asynchronously with `r+`, which never creates a file. A write
   * still in flight at a signal can therefore leave nothing once the undo removed the path.
   */
  const create = (target: string, text: string): Promise<void> => {
    closeSync(openSync(target, "wx"));
    madeFiles.push(target);
    return writeFile(target, text, { flag: "r+" });
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
      // The file in flight is already in `madeFiles`, and its write can no longer create it (`create`).
      undo();
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
