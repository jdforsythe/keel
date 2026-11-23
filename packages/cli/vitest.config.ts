import { keelConfig } from "@keel/tooling/vitest-config";

export default keelConfig({
  test: {
    include: ["test/**/*.test.ts", "conformance/**/*.test.ts"],
    passWithNoTests: true,
    // Tests here run the checker's type pass, a fresh TypeScript program per case, and the compat suites spawn several
    // builds per property run; on a busy machine one takes several seconds. The review conformance runs the `keel`
    // binary about 80 times in one test, each start near half a second.
    testTimeout: 120_000,
    // The `keel dev` cases start the real binary over a project written a moment before and wait for an edit to reach
    // the server. Each child inherits this, and `keel dev` then has Vite's watcher read file times itself instead of
    // taking macOS file events: a busy machine delivers those seconds late or drops them, and reports the writes of the
    // project's own setup as later changes (one to `vite.config.ts` restarts the dev server under the case).
    env: { CHOKIDAR_USEPOLLING: "1" },
  },
});
