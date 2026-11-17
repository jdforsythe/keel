import { strykerConfig } from "../../tooling/stryker.mjs";

const base = strykerConfig("testing", 70);

// Stryker's vitest runner defaults to the threads pool. z3-solver run from a worker thread can abort
// (emscripten_futex_wait asserts it is on the main thread) when prove's main-thread calls meet its solver thread
// mid-allocation; `pnpm test` runs this package in forks, so its mutation run does too.
export default { ...base, vitest: { ...base.vitest, pool: "forks" } };
