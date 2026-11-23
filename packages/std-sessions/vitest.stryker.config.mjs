// Vitest config used only by `pnpm mutate`. Excluded here (still run by `pnpm test`):
// - conformance/group-{replay,schedule,order,deterministic,isolation}.test.ts and conformance/net-event.test.ts: seeded
//   properties of 4 to 10 runs that each render an app, 129 s of the package's 154 s of tests. Every mutant they cover
//   would wait on them for its timeout or its survival. test/group-{handle,stream,caller,app}.test.ts cover the same
//   code in about 7 s.
// Added here: vitest.stryker.setup.mjs, which carries Stryker's coverage and active mutant into the worker threads a
// group's users run in.
import { QuickFirst } from "@keel/tooling/quick-first";
import { defineConfig, mergeConfig } from "vitest/config";
import base from "./vitest.config.ts";

export default mergeConfig(
  base,
  defineConfig({
    test: {
      exclude: [
        "conformance/group-replay.test.ts",
        "conformance/group-schedule.test.ts",
        "conformance/group-order.test.ts",
        "conformance/group-deterministic.test.ts",
        "conformance/group-isolation.test.ts",
        "conformance/net-event.test.ts",
        "conformance/.tmp-*/**",
        "conformance/fixtures/**",
        "**/node_modules/**",
      ],
      setupFiles: ["vitest.stryker.setup.mjs"],
      sequence: { sequencer: QuickFirst },
    },
  }),
);
