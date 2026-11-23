// Setup file of mutation runs only (vitest.stryker.config.mjs). Stryker credits a mutant to the tests during which it
// was reached, runs only those tests against it, turns it on once the test file has loaded, and with `ignoreStatic`
// leaves out a mutant reached only while a module loads. Most modules of this package are also loaded a second time
// inside some command test (`keel session` imports `@keel/std-sessions/tools` through its own loader), so a schema, a
// table or a pattern declared at the top of a module would be held against that one test, which asserts nothing
// about it, and no test that imports the module could ever see it changed.
// A file under test/unit/ tests the modules it imports, what they do when they load included. For such a file:
// - in the dry run, what its imports and its hooks reach is credited to every test of the file;
// - in a mutant run, the mutant is on before the file's imports run, so load-time code is the mutated code.
// Elsewhere Stryker's rule holds.
import { afterAll, beforeEach, expect, inject } from "vitest";

const key = inject("globalNamespace");
const ns = globalThis[key] ?? {};
globalThis[key] = ns;
const unit = /[\\/]test[\\/]unit[\\/]/.test(expect.getState().testPath ?? "");

if (unit && inject("mode") === "mutant") ns.activeMutant = inject("activeMutant");
if (unit && inject("mode") !== "mutant") {
  const before = { ...ns.mutantCoverage?.static };
  const tests = new Set();
  beforeEach(() => {
    if (ns.currentTestId !== undefined) tests.add(ns.currentTestId);
  });
  afterAll(() => {
    ns.mutantCoverage ??= { static: {}, perTest: {} };
    const cov = ns.mutantCoverage;
    const reached = Object.keys(cov.static).filter((id) => cov.static[id] > (before[id] ?? 0));
    for (const test of tests) {
      cov.perTest[test] ??= {};
      for (const mutant of reached) cov.perTest[test][mutant] ??= 1;
    }
  });
}
