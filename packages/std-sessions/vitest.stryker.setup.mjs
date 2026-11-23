// Setup file of mutation runs only (vitest.stryker.config.mjs). Stryker credits a mutant to the tests during which it
// was reached, runs only those tests against it, and with `ignoreStatic` leaves out a mutant reached only while a
// module loads. Most modules of this package are also loaded a second time inside some command test (`keel session`
// imports `@keel/std-sessions/tools` through its own loader), so a schema, a table or a pattern declared at the top of
// a module would be held against that one test, which asserts nothing about it.
// A file under test/unit/ tests the modules it imports, what they do when they load included: what its imports and
// its hooks reach is credited to every test of the file. Elsewhere Stryker's rule holds.
import { afterAll, beforeEach, inject } from "vitest";

const UNIT = /[\\/]test[\\/]unit[\\/]/;
const key = inject("globalNamespace");
const ns = globalThis[key] ?? {};
globalThis[key] = ns;

if (inject("mode") !== "mutant") {
  const before = { ...ns.mutantCoverage?.static };
  const tests = new Set();
  let unit = false;
  beforeEach(({ task }) => {
    unit = UNIT.test(task.file?.filepath ?? "");
    if (ns.currentTestId !== undefined) tests.add(ns.currentTestId);
  });
  afterAll(() => {
    if (!unit) return;
    ns.mutantCoverage ??= { static: {}, perTest: {} };
    const cov = ns.mutantCoverage;
    const reached = Object.keys(cov.static).filter((id) => cov.static[id] > (before[id] ?? 0));
    for (const test of tests) {
      cov.perTest[test] ??= {};
      for (const mutant of reached) cov.perTest[test][mutant] ??= 1;
    }
  });
}
