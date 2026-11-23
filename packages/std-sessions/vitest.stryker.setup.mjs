// Setup file of mutation runs only (vitest.stryker.config.mjs). Stryker credits a mutant to the tests during which
// its own thread reached it, and runs only those tests against it. Four kinds of test here reach code another way,
// and this file credits them:
// - a group user's code (`src/group/internal/userRealm.ts` and what it loads) runs in a worker thread: every `Worker`
//   a test starts also preloads vitest.stryker.preload.mjs, which writes the mutant ids the worker reaches to the
//   file named in `KEEL_MUTATE_COVER`;
// - a `keel session` job (`src/commandJob.ts`) runs in the worker processes of the `keel test` run a test starts:
//   `NODE_OPTIONS` preloads the same file into them;
// - a test file that does its work in `beforeAll` (conformance/to-test.test.ts): what its hooks reach, in this
//   thread or through the two ways above, is credited to every test of the file;
// - a file under test/unit/ tests the modules it imports, what they do when they load included (a schema, a table, a
//   pattern declared at the top of a module): what its imports reach is credited to every test of the file. Elsewhere
//   Stryker's `ignoreStatic` holds: code that only runs at load is not held against a test that happens to load it.
// In a mutant run the active mutant's id is put in `__STRYKER_ACTIVE_MUTANT__`, which a worker or child process
// inherits and the instrumented code reads.
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import workerThreads from "node:worker_threads";
import { afterAll, afterEach, beforeAll, beforeEach, inject } from "vitest";

const UNIT = /[\\/]test[\\/]unit[\\/]/;
const PRELOAD = pathToFileURL(path.resolve("vitest.stryker.preload.mjs")).href;
const key = inject("globalNamespace");
const ns = globalThis[key] ?? {};
globalThis[key] = ns;

const Real = workerThreads.Worker;
if (Real.name !== "MutationWorker") {
  class MutationWorker extends Real {
    constructor(file, options = {}) {
      super(file, { ...options, execArgv: [...(options.execArgv ?? process.execArgv), "--import", PRELOAD] });
    }
  }
  workerThreads.Worker = MutationWorker;
  syncBuiltinESMExports();
}
if (!(process.env.NODE_OPTIONS ?? "").includes(PRELOAD))
  process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS ?? ""} --import ${PRELOAD}`.trim();

/** The mutant ids written to `file` by workers and child processes; the file is removed. */
const reachedIn = (file) => {
  if (!fs.existsSync(file)) return [];
  const ids = fs.readFileSync(file, "utf8").split("\n").filter(Boolean);
  fs.rmSync(file, { force: true });
  return ids;
};

if (inject("mode") === "mutant") {
  const activate = () => {
    if (ns.activeMutant !== undefined) process.env.__STRYKER_ACTIVE_MUTANT__ = String(ns.activeMutant);
  };
  activate();
  beforeAll(activate);
} else {
  const stem = path.join(os.tmpdir(), `keel-mutate-cover-${process.pid}-${Date.now()}`);
  const between = `${stem}-hooks`;
  const tests = new Set();
  let n = 0;
  let current;
  const before = { ...ns.mutantCoverage?.static };
  let loaded = {};
  let unit = false;
  process.env.KEEL_MUTATE_COVER = between;
  beforeAll(() => {
    loaded = { ...ns.mutantCoverage?.static };
  });
  beforeEach(({ task }) => {
    unit = UNIT.test(task.file?.filepath ?? "");
    current = { id: ns.currentTestId, file: `${stem}-${n++}` };
    if (current.id !== undefined) tests.add(current.id);
    process.env.KEEL_MUTATE_COVER = current.file;
  });
  afterEach(() => {
    process.env.KEEL_MUTATE_COVER = between;
    const reached = reachedIn(current.file);
    if (current.id === undefined || reached.length === 0) return;
    ns.mutantCoverage ??= { static: {}, perTest: {} };
    ns.mutantCoverage.perTest[current.id] ??= {};
    const own = ns.mutantCoverage.perTest[current.id];
    for (const mutant of reached) own[mutant] = (own[mutant] ?? 0) + 1;
  });
  afterAll(() => {
    process.env.KEEL_MUTATE_COVER = "";
    ns.mutantCoverage ??= { static: {}, perTest: {} };
    const cov = ns.mutantCoverage;
    // What this thread reached outside a test since the file was loaded: its hooks' work.
    const hooks = Object.keys(cov.static).filter((id) => cov.static[id] > (loaded[id] ?? 0));
    for (const id of hooks) if (loaded[id] === undefined) delete cov.static[id];
    const imports = unit ? Object.keys(loaded).filter((id) => loaded[id] > (before[id] ?? 0)) : [];
    const reached = [...new Set([...hooks, ...imports, ...reachedIn(between)])];
    for (const test of tests) {
      cov.perTest[test] ??= {};
      for (const mutant of reached) cov.perTest[test][mutant] ??= 1;
    }
  });
}
