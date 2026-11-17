import { isMainThread } from "node:worker_threads";
import type { Transaction } from "@keel/store";
import { sourcesOf } from "@keel/store/internal";
import type { ArrowFunctionExpression, Function as FunctionNode } from "oxc-parser";
import { modelError } from "../internal/modelError.ts";
import { Outside } from "./internal/Outside.ts";
import type { Tools } from "./internal/Tools.ts";
import { loadTools } from "./internal/loadTools.ts";
import { proveError } from "./internal/proveError.ts";
import { readModel } from "./internal/readModel.ts";
import { sortTable } from "./internal/sortTable.ts";
import { translator } from "./internal/translator.ts";
import type { Proof } from "./types/Proof.ts";
import type { ProveOptions } from "./types/ProveOptions.ts";

/** Z3 resource units per check when `rlimit` is not given (k.prove). */
const RLIMIT = 10_000_000;
/** The array lengths a counterexample is searched within before the unbounded check. */
const BOUNDS = [0, 1, 2, 3];

/** The last call's Z3 work: Z3 runs one evaluation at a time, so each call starts when the one before has settled. */
let turn: Promise<unknown> = Promise.resolve();

/** The function a source text holds, parsed as an expression; an offset counts in that text. */
const parsed = (tools: Tools, f: object): ArrowFunctionExpression | FunctionNode => {
  const r = tools.parse("prove.js", `(${String(f)})`);
  const first = r.program.body[0];
  if (r.errors.length > 0 || first?.type !== "ExpressionStatement") throw new Outside("source that does not parse", 0);
  let e = first.expression;
  while (e.type === "ParenthesizedExpression") e = e.expression;
  if (e.type !== "ArrowFunctionExpression" && e.type !== "FunctionExpression") throw new Outside(e.type, 0);
  return e;
};

/** E1715 for an `Outside` thrown by `run`, naming `label` and the construct. */
const fragment = <R>(label: string, run: () => R): R => {
  try {
    return run();
  } catch (e) {
    if (!(e instanceof Outside)) throw e;
    const at = e.at === undefined ? "" : ` at offset ${e.at} is outside the fragment`;
    throw proveError("E1715", `${label}: ${e.construct}${at}; explore remains`, {
      in: label,
      construct: e.construct,
      ...(e.at === undefined ? {} : { at: e.at }),
    });
  }
};

/**
 * The induction step of one transaction: unsat for every state and payload, else E1716 or E1717. The post-state parses
 * as the pre-state is assumed to, each integer within ±(2^53 − 1).
 */
async function step<T>(tools: Tools, t: Transaction<T, unknown>, rlimit: number): Promise<void> {
  const st = t.store;
  const src = sourcesOf(t);
  if (src === undefined) throw modelError("E1710", `prove: ${t.name} is not a transaction`, { name: t.name });
  const sorts = sortTable();
  const axioms: string[] = [];
  /** What the functions need to run as the terms say: an option present, an index in range, a key the schema allows. */
  const need: string[] = [];
  /** What keeps integers exact: each `+`, `-` and `*` result within ±2^53. */
  const exact: string[] = [];
  const fresh = { n: 0 };
  const S = fragment(t.name, () => sorts.ofNode(st.schema.node, "state"));
  const P = fragment(t.name, () => sorts.ofNode(t.schema.node, "payload"));
  const fn = fragment(t.name, () => parsed(tools, src.fn));
  const post = fragment(t.name, () => {
    const tr = translator(sorts, 1, axioms, fresh, need, exact);
    const args = [
      { v: "val", t: S, e: "s" },
      { v: "val", t: P, e: "p" },
    ] as const;
    return tr.coerce(tr.apply(fn, args, new Map(), S), S, fn);
  });
  const invariants = src.invariants.map((f, i) => {
    const label = `${st.id} invariant ${i + 1}`;
    return { label, node: fragment(label, () => parsed(tools, f)) };
  });
  const holds = (x: string): string[] =>
    invariants.map(({ label, node }) =>
      fragment(label, () => {
        const tr = translator(sorts, 1, axioms, fresh, need, exact);
        const v = tr.must(tr.apply(node, [{ v: "val", t: S, e: x }], new Map(), undefined), node);
        return v.t.k === "bool" ? v.e : tr.coerce(v, { k: "bool" }, node);
      }),
    );
  const before = [sorts.wf(S, "s", 2), sorts.wf(P, "p", 2), ...holds("s")];
  const early = axioms.length;
  /** The goal without the integer ranges: what a counterexample breaks unless it breaks those alone. */
  const rest = sorts.and([sorts.wf(S, "post", 0), ...holds("post"), ...need]);
  const goal = sorts.and([rest, sorts.wf(S, "post", 1), ...exact]);
  const text = `(set-option :smt.random_seed 0)(set-option :rlimit ${rlimit})${sorts.prelude()}(declare-const s ${sorts.smt(S)})(declare-const p ${sorts.smt(P)})${axioms.slice(0, early).join("")}(define-fun post () ${sorts.smt(S)} ${post})${axioms.slice(early).join("")}${before.map((h) => `(assert ${h})`).join("")}`;
  const lengths = [...sorts.lengths(S, "s"), ...sorts.lengths(P, "p")];
  /** One check that `g` can break, arrays within `bound`: the verdict, or the counterexample of a `sat` model. */
  const ask = async (bound: number | undefined, g: string) => {
    const solver = tools.open();
    try {
      const within = bound === undefined ? "" : lengths.map((l) => `(assert (<= ${l} ${bound}))`).join("");
      const out = (await solver.run(`${text}(assert (not ${g}))${within}(check-sat)`)).trim();
      if (out.includes("(error")) throw new Error(`prove ${t.name}: Z3 refused the translation: ${out.split("\n")[0]}`);
      if (out !== "sat") return out;
      const [state, payload] = await readModel(
        solver,
        [
          [S, "s"],
          [P, "p"],
        ],
        sorts.lits,
      );
      return { transaction: t.name, state, payload };
    } finally {
      solver.close();
    }
  };
  for (const bound of [...(lengths.length === 0 ? [] : BOUNDS), undefined]) {
    const found = await ask(bound, goal);
    if (typeof found !== "string") {
      // A counterexample of `rest` comes first; with none within this bound, only an integer left its range.
      const other = goal === rest ? found : await ask(bound, rest);
      const data = typeof other === "string" ? found : other;
      throw proveError(
        "E1716",
        `${t.name} ${
          other === "unsat"
            ? "leaves the safe integer range from this state; bound the schema or guard it"
            : "breaks the schema or an invariant from this state; it may be unreachable"
        }\n${JSON.stringify(data)}`,
        data,
      );
    }
    if (found === "unsat" && bound === undefined) return;
  }
  throw proveError("E1717", `${t.name}: no verdict within rlimit ${rlimit}`, { transaction: t.name, rlimit });
}

/**
 * Prove a store's invariants by induction with Z3 (k.prove): `initial` passes `check`, and each transaction maps every
 * state that parses and satisfies the invariants, with every payload that parses, to such a state. Resolves with the
 * transactions proven and the Z3 version. Rejects E1715 (outside the fragment, or a schema without a sort), E1716 (a
 * counterexample as JSON on the second line), E1717 (no verdict within `rlimit`), E1718 (`z3-solver` not installed),
 * E1721 (called in a worker thread, before any other check).
 * Calls take turns: the Z3 work of one starts when the call before it has settled.
 */
export async function prove<T>(
  transactions: readonly Transaction<T, unknown>[],
  options: ProveOptions = {},
): Promise<Proof> {
  if (!isMainThread) throw proveError("E1721", "prove runs on the main thread; this call is in a worker thread", {});
  const st = transactions[0]?.store;
  const names = transactions.map((t) => t.name);
  const rlimit = options.rlimit ?? RLIMIT;
  if (st === undefined || transactions.some((t) => t.store !== st) || new Set(names).size !== names.length)
    throw modelError("E1710", "prove: give one or more transactions of one store, each once", { names });
  if (!Number.isSafeInteger(rlimit) || rlimit < 1 || rlimit > 0xffffffff)
    throw modelError("E1710", `prove: rlimit ${rlimit} is not an integer from 1 to 4294967295`, { rlimit });
  const initial = st.snapshot().initial;
  if (!st.check(initial).ok) {
    const data = { state: initial };
    throw proveError("E1716", `${st.id}: initial breaks the schema or an invariant\n${JSON.stringify(data)}`, data);
  }
  const work = async (): Promise<Proof> => {
    const tools = await loadTools();
    for (const t of transactions) await step(tools, t, rlimit);
    return { proven: names, z3: tools.version };
  };
  const run = turn.then(work, work);
  turn = run;
  return run;
}
