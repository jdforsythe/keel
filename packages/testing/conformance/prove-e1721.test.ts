import { once } from "node:events";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import { invariant, store, transaction } from "@keel/store";
import { prove } from "@keel/testing/prove";
// k.prove, Rules "E1721 `prove` called in a worker thread, where Z3 can abort or hang (fix: vitest `pool: "forks"`)."
// Spec: k.prove, clause "In a worker thread, `prove` rejects E1721."
// Seed: 1337. The worker body is prove-e1721.worker.ts, loaded through Node's type stripping.
import { testTime } from "@keel/tooling/test-time";
import { describe, expect, it } from "vitest";

const SEED = 1337;
const LONG = 120_000;
/** tsx compiles the workspace TypeScript sources inside the worker. */
const findLoader = (from: string): string => {
  const candidate = join(from, "node_modules/tsx/dist/loader.mjs");
  if (existsSync(candidate)) return pathToFileURL(candidate).href;
  const parent = dirname(from);
  if (parent === from) throw new Error("tsx loader not found above the test file");
  return findLoader(parent);
};
const TSX_LOADER = findLoader(import.meta.dirname);
const WORKER_BOUND_MS = testTime(30_000);

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

describe("k.prove: E1721", () => {
  it(
    "in a worker thread, prove rejects E1721",
    async () => {
      const worker = new Worker(join(import.meta.dirname, "prove-e1721.worker.ts"), {
        execArgv: ["--import", TSX_LOADER],
      });
      try {
        const [message] = await once(worker, "message", { signal: AbortSignal.timeout(WORKER_BOUND_MS) });
        expect(isRecord(message) ? message : {}).toEqual({ code: "E1721" });
      } finally {
        await worker.terminate();
      }
    },
    LONG,
  );

  it(
    "on the main thread the same store proves, naming both transactions",
    async () => {
      const txs: Parameters<typeof prove>[0][number][] = [];
      scope(() => {
        const st = store(s.object({ n: s.int({ min: 0, max: 9 }) }), { n: 0 }, { id: "mt.count" });
        invariant(st, (state) => state.n >= 0);
        txs.push(transaction(st, "mt.inc", s.object({}), (state) => ({ n: state.n < 9 ? state.n + 1 : state.n })));
        txs.push(transaction(st, "mt.dec", s.object({}), (state) => ({ n: state.n > 0 ? state.n - 1 : state.n })));
      });
      const result = await prove(txs);
      expect([...result.proven].sort()).toEqual(["mt.dec", "mt.inc"]);
    },
    LONG,
  );
});
