// Worker body for prove-e1721.test.ts: builds the counter store, calls `prove`, and posts the outcome.
import { parentPort } from "node:worker_threads";
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import { invariant, store, transaction } from "@keel/store";
import { prove } from "@keel/testing/prove";

type Tx = Parameters<typeof prove>[0][number];

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const codeOf = (e: unknown): string | undefined => (isRecord(e) && typeof e.code === "string" ? e.code : undefined);

const run = async (): Promise<unknown> => {
  const txs: Tx[] = [];
  scope(
    () => {
      const st = store(s.object({ n: s.int({ min: 0, max: 9 }) }), { n: 0 }, { id: "wk.count" });
      invariant(st, (state) => state.n >= 0);
      txs.push(transaction(st, "wk.inc", s.object({}), (state) => ({ n: state.n < 9 ? state.n + 1 : state.n })));
      txs.push(transaction(st, "wk.dec", s.object({}), (state) => ({ n: state.n > 0 ? state.n - 1 : state.n })));
    },
    { detached: true },
  );
  try {
    await prove(txs);
    return { ok: true };
  } catch (e) {
    return { code: codeOf(e) ?? String(e) };
  }
};

parentPort?.postMessage(await run());
