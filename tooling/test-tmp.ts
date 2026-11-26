// The one way a test makes a temp folder. `tempDir(prefix)` is `mkdtempSync` in the run's temp root (`os.tmpdir()`,
// which `test-tmp-global.ts` points at a folder of the run's own) or in `parent`, and registers the folder for removal:
// `test-tmp-setup.ts`, a setup file of every `keelConfig` run, removes each registered folder when the test file ends,
// whether its tests passed, failed or threw. A test calls `tempDir` and writes no teardown of its own. Structure-lint
// S0018 refuses a `mkdtemp` call anywhere else in test code.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const KEY = Symbol.for("keel.tempDirs");

/** The set of folders this worker made, held on `globalThis` so a setup file and a test file share it. */
function registry(): Set<string> {
  const own: unknown = Reflect.get(globalThis, KEY);
  if (own instanceof Set) return own;
  const made = new Set<string>();
  Reflect.set(globalThis, KEY, made);
  return made;
}

/** A new folder named `<prefix><random>` in `parent` (default: the temp folder), removed when the test file ends. */
export function tempDir(prefix: string, parent: string = tmpdir()): string {
  const dir = mkdtempSync(join(parent, prefix));
  registry().add(dir);
  return dir;
}

/** Removes every folder `tempDir` made in this worker and forgets them. */
export function removeTempDirs(): void {
  const made = registry();
  for (const dir of made) rmSync(dir, { recursive: true, force: true });
  made.clear();
}
