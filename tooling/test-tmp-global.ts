// Global setup of every `keelConfig` run: the run gets a temp folder of its own. Before any worker starts it makes
// `keel-run-<random>` in the machine's temp folder and points `TMPDIR` at it, so every `os.tmpdir()` in the run, in a
// test, in the code under test and in a process a test spawns, lands inside it. When the run ends it removes that
// folder, and fails the run (T0002, one line per prefix) if entries were left in it: a test or a command that made a temp
// folder and did not remove it. A run therefore never leaves anything in the machine's temp folder, and a leak has a
// name. The folders conformance files make with no teardown (the conformance-writer's to fix) are named in
// `leftByConformance` below by what the package's conformance files make, so they are removed with the run's folder
// and never fail it.
import { type Dirent, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const MKDTEMP_PREFIX = /mkdtemp(?:Sync)?\([^"'`\n]*["'`]([^"'`/]+)["'`]/g;

/** Node's own code cache, which it makes in the temp folder of a process that enables it: not a test's folder. */
const NODE_COMPILE_CACHE = "node-compile-cache";

/** `.ts`, `.mjs` and `.tsx` files under `dir`, without descending into `node_modules`. */
function sources(dir: string): string[] {
  const out: string[] = [];
  let entries: Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== "node_modules") out.push(...sources(p));
    } else if (/\.[cm]?[jt]sx?$/.test(e.name)) out.push(p);
  }
  return out;
}

/** The prefixes the working directory's `conformance/` files pass to `mkdtemp`: their leftovers are not this run's to fail. */
function leftByConformance(cwd: string): Set<string> {
  const prefixes = new Set<string>();
  for (const file of sources(join(cwd, "conformance")))
    for (const m of readFileSync(file, "utf8").matchAll(MKDTEMP_PREFIX)) if (m[1] !== undefined) prefixes.add(m[1]);
  return prefixes;
}

/** The prefix of a folder name `mkdtemp` made: the name without its six random characters. */
const prefixOf = (name: string): string => name.slice(0, -6);

export default function setup(): () => void {
  const outer = tmpdir();
  const root = mkdtempSync(join(outer, "keel-run-"));
  const before = process.env.TMPDIR;
  process.env.TMPDIR = root;
  return () => {
    if (before === undefined) Reflect.deleteProperty(process.env, "TMPDIR");
    else process.env.TMPDIR = before;
    const left = readdirSync(root);
    const allowed = leftByConformance(process.cwd());
    rmSync(root, { recursive: true, force: true });
    const named = new Map<string, number>();
    for (const name of left) {
      if (name === NODE_COMPILE_CACHE) continue;
      const prefix = prefixOf(name);
      if (allowed.has(prefix)) continue;
      named.set(prefix, (named.get(prefix) ?? 0) + 1);
    }
    for (const [prefix, n] of named) {
      process.stderr.write(
        `T0002 ${prefix}* ${n} left in the run's temp root by a test or the code it ran; make a test's folder with tempDir (tooling/test-tmp.ts), and have a command remove its own\n`,
      );
      process.exitCode = 1;
    }
  };
}
