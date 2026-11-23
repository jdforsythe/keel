// Preloaded (`--import`) into each worker thread and child process a test starts under `pnpm mutate`
// (vitest.stryker.setup.mjs adds it). Stryker's instrumented code counts the mutants it reaches in
// `globalThis.__stryker__.mutantCoverage` of its own thread, which the test's thread never sees. Here each mutant id
// reached is appended, once, to the file the test names in `KEEL_MUTATE_COVER`; the setup file reads it back as
// coverage. The active mutant needs no help: the instrumented code reads `__STRYKER_ACTIVE_MUTANT__` from the
// environment a worker or child inherits.
import fs from "node:fs";

const file = process.env.KEEL_MUTATE_COVER;
const ns = globalThis.__stryker__ ?? {};
if (file && ns.keelCover === undefined) {
  const seen = new Set();
  const reached = new Proxy(
    {},
    {
      set(target, id, count) {
        target[id] = count;
        if (typeof id === "string" && !seen.has(id)) {
          seen.add(id);
          try {
            fs.appendFileSync(file, `${id}\n`);
          } catch {
            // The directory of the file is gone: nothing reads it any more.
          }
        }
        return true;
      },
    },
  );
  globalThis.__stryker__ = ns;
  ns.keelCover = file;
  ns.mutantCoverage = { static: reached, perTest: {} };
}
