// Test helpers (not a test file): a counter store whose transactions commute, and a board store whose edits do not.
import { owner, scope } from "@keel/reactive";
import { s } from "@keel/schema";
import { invariant, isolate, store, transaction, tx } from "@keel/store";
import type { Snapshot } from "@keel/store";

export const SEED = 1337;

const Tally = s.object({ n: s.int(), items: s.array(s.object({ id: s.string(), v: s.int() })) });

/** `t.tally`: `inc` adds to `n`, `put` adds an item of a fresh id; every pair of them commutes. */
export const tallyStores = () => () => {
  const tally = store(Tally, { n: 0, items: [] }, { id: "t.tally" });
  const inc = transaction(tally, "t.inc", s.object({ by: s.int() }), (st, p) => ({ ...st, n: st.n + p.by }), {
    concurrent: "rebase",
  });
  const put = transaction(
    tally,
    "t.put",
    s.object({ id: s.string(), v: s.int() }),
    (st, p) => ({ ...st, items: [...st.items, { id: p.id, v: p.v }] }),
    { concurrent: "rebase" },
  );
  return { tally, inc, put };
};

const Board = s.object({ titles: s.array(s.object({ id: s.string(), title: s.string() })) });

/** `t.board`: `add` a titled item, `rename` one; titles are unique. */
export const boardStores = () => () => {
  const board = store(Board, { titles: [] }, { id: "t.board" });
  invariant(board, (st) => new Set(st.titles.map((t) => t.title)).size === st.titles.length);
  const add = transaction(
    board,
    "t.add",
    s.object({ id: s.string(), title: s.string() }),
    (st, p) => ({ titles: [...st.titles, { id: p.id, title: p.title }] }),
    { concurrent: "rebase" },
  );
  const rename = transaction(
    board,
    "t.rename",
    s.object({ id: s.string(), title: s.string() }),
    (st, p) => ({ titles: st.titles.map((t) => (t.id === p.id ? { ...t, title: p.title } : t)) }),
    { concurrent: "rebase" },
  );
  return { board, add, rename };
};

export type Step = { readonly name: string; readonly payload: unknown; readonly base?: number };

/** The stored snapshot after `steps` (each must commit), built in its own registry. */
export function snapshotAfter(
  make: () => { readonly [k: string]: unknown },
  steps: readonly Step[],
): Snapshot<unknown> {
  const out: Snapshot<unknown>[] = [];
  const sc = scope(() => {
    const own = owner();
    if (own !== undefined) isolate(own);
    const made = make();
    let snap: (() => Snapshot<unknown>) | undefined;
    const txs = new Map<string, Parameters<typeof tx>[0]>();
    for (const v of Object.values(made)) {
      if (typeof v !== "object" || v === null) continue;
      if ("concurrent" in v && "name" in v && "store" in v && typeof v.name === "string" && isTx(v)) txs.set(v.name, v);
      if ("snapshot" in v && typeof v.snapshot === "function" && isStoreLike(v)) snap = () => v.snapshot();
    }
    for (const step of steps) {
      const t = txs.get(step.name);
      if (t === undefined) throw new Error(`helpers: no transaction ${step.name}`);
      const r = tx(t, step.payload, step.base === undefined ? {} : { base: step.base });
      if (!r.ok) throw new Error(`helpers: ${step.name} was refused`);
    }
    if (snap === undefined) throw new Error("helpers: no store");
    out.push(JSON.parse(JSON.stringify(snap())));
  });
  sc.dispose();
  const [first] = out;
  if (first === undefined) throw new Error("helpers: build failed");
  return first;
}

const isTx = (v: object): v is Parameters<typeof tx>[0] => "concurrent" in v;
const isStoreLike = (v: object): v is { snapshot(): Snapshot<unknown> } => "snapshot" in v && "restore" in v;

/** Freeze `v` and everything in it. */
export function deepFreeze<T>(v: T): T {
  if (typeof v === "object" && v !== null) {
    for (const k of Object.keys(v)) deepFreeze(Reflect.get(v, k));
    Object.freeze(v);
  }
  return v;
}
