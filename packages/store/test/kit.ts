// Shared test kit: a small counter store and a pure model of it. Seed 1337.
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import fc from "fast-check";
import { store, transaction } from "../src/index.ts";

export const opts = { seed: 1337, numRuns: 200 };

export const Counter = s.object({ n: s.int(), tags: s.array(s.string()) });
export interface Counter {
  n: number;
  tags: string[];
}

export type Op =
  | { kind: "add"; by: number }
  | { kind: "tag"; tag: string }
  | { kind: "reset" }
  | { kind: "undo" }
  | { kind: "bad" };

export const opArb: fc.Arbitrary<Op> = fc.oneof(
  fc.integer({ min: -50, max: 50 }).map((by): Op => ({ kind: "add", by })),
  fc.string({ maxLength: 4 }).map((tag): Op => ({ kind: "tag", tag })),
  fc.constant<Op>({ kind: "reset" }),
  fc.constant<Op>({ kind: "undo" }),
  fc.constant<Op>({ kind: "bad" }),
);

export const initial: Counter = { n: 0, tags: [] };

/** Pure model: the committed-state history; `undo` pops it. */
export function model(ops: readonly Op[]): Counter[] {
  const hist: Counter[] = [initial];
  for (const op of ops) {
    const top = hist[hist.length - 1] ?? initial;
    if (op.kind === "add") hist.push({ ...top, n: top.n + op.by });
    else if (op.kind === "tag") hist.push({ ...top, tags: [...top.tags, op.tag] });
    else if (op.kind === "reset") hist.push(initial);
    else if (op.kind === "undo" && hist.length > 1) hist.pop();
  }
  return hist;
}

export function makeCounter(clock?: () => number) {
  const box: { kit?: ReturnType<typeof build> } = {};
  const build = () => {
    const c = store(Counter, initial, clock === undefined ? undefined : { clock });
    return {
      c,
      add: transaction(c, "counter.add", s.object({ by: s.int() }), (st, { by }) => ({ ...st, n: st.n + by })),
      tag: transaction(c, "counter.tag", s.object({ tag: s.string() }), (st, { tag }) => ({
        ...st,
        tags: [...st.tags, tag],
      })),
      reset: transaction(c, "counter.reset", s.object({}), () => ({ n: 0, tags: [] })),
    };
  };
  const sc = scope(() => {
    box.kit = build();
  });
  if (box.kit === undefined) throw new Error("scope body did not run");
  return { ...box.kit, dispose: sc.dispose };
}
