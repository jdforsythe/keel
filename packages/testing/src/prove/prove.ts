import type { Transaction } from "@keel/store";
import { sourcesOf } from "@keel/store/internal";
import type { ArrowFunctionExpression, Function as FunctionNode } from "oxc-parser";
import { modelError } from "../internal/modelError.ts";
import { Outside } from "./internal/Outside.ts";
import type { Tools } from "./internal/Tools.ts";
import type { Ty } from "./internal/Ty.ts";
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

/** The induction step of one transaction: unsat for every state and payload, else E1716 or E1717. */
async function step<T>(tools: Tools, t: Transaction<T, unknown>, rlimit: number): Promise<void> {
  const st = t.store;
  const src = sourcesOf(t);
  if (src === undefined) throw modelError("E1710", `prove: ${t.name} is not a transaction`, { name: t.name });
  const sorts = sortTable();
  const axioms: string[] = [];
  const fresh = { n: 0 };
  const S = fragment(t.name, () => sorts.ofNode(st.schema.node, "state"));
  const P = fragment(t.name, () => sorts.ofNode(t.schema.node, "payload"));
  const fn = fragment(t.name, () => parsed(tools, src.fn));
  const post = fragment(t.name, () => {
    const tr = translator(sorts, 1, axioms, fresh);
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
        const tr = translator(sorts, 1, axioms, fresh);
        const v = tr.must(tr.apply(node, [{ v: "val", t: S, e: x }], new Map(), undefined), node);
        return v.t.k === "bool" ? v.e : tr.coerce(v, { k: "bool" }, node);
      }),
    );
  const before = [sorts.wf(S, "s", true), sorts.wf(P, "p", true), ...holds("s")];
  const early = axioms.length;
  const goal = sorts.and([sorts.wf(S, "post", false), ...holds("post")]);
  const text = `(set-option :smt.random_seed 0)(set-option :rlimit ${rlimit})${sorts.prelude()}(declare-const s ${sorts.smt(S)})(declare-const p ${sorts.smt(P)})${axioms.slice(0, early).join("")}(define-fun post () ${sorts.smt(S)} ${post})${axioms.slice(early).join("")}${before.map((h) => `(assert ${h})`).join("")}(assert (not ${goal}))`;
  const lengths = [...sorts.lengths(S, "s"), ...sorts.lengths(P, "p")];
  for (const bound of [...(lengths.length === 0 ? [] : BOUNDS), undefined]) {
    const solver = tools.open();
    try {
      const within = bound === undefined ? "" : lengths.map((l) => `(assert (<= ${l} ${bound}))`).join("");
      const out = (await solver.run(`${text}${within}(check-sat)`)).trim();
      if (out.includes("(error")) throw new Error(`prove ${t.name}: Z3 refused the translation: ${out.split("\n")[0]}`);
      if (out === "sat") {
        const terms: (readonly [Ty, string])[] = [
          [S, "s"],
          [P, "p"],
        ];
        const [state, payload] = await readModel(solver, terms, sorts.lits);
        const data = { transaction: t.name, state, payload };
        throw proveError(
          "E1716",
          `${t.name} breaks the schema or an invariant from this state; it may be unreachable\n${JSON.stringify(data)}`,
          data,
        );
      }
      if (out === "unsat" && bound === undefined) return;
    } finally {
      solver.close();
    }
  }
  throw proveError("E1717", `${t.name}: no verdict within rlimit ${rlimit}`, { transaction: t.name, rlimit });
}

/**
 * Prove a store's invariants by induction with Z3 (k.prove): `initial` passes `check`, and each transaction maps every
 * state that parses and satisfies the invariants, with every payload that parses, to such a state. Resolves with the
 * transactions proven and the Z3 version. Rejects E1715 (outside the fragment, or a schema without a sort), E1716 (a
 * counterexample as JSON on the second line), E1717 (no verdict within `rlimit`), E1718 (`z3-solver` not installed).
 */
export async function prove<T>(
  transactions: readonly Transaction<T, unknown>[],
  options: ProveOptions = {},
): Promise<Proof> {
  const st = transactions[0]?.store;
  const names = transactions.map((t) => t.name);
  const rlimit = options.rlimit ?? RLIMIT;
  if (st === undefined || transactions.some((t) => t.store !== st) || new Set(names).size !== names.length)
    throw modelError("E1710", "prove: give one or more transactions of one store, each once", { names });
  if (!Number.isSafeInteger(rlimit) || rlimit < 1)
    throw modelError("E1710", `prove: rlimit ${rlimit} is not a positive integer`, { rlimit });
  const initial = st.snapshot().initial;
  if (!st.check(initial).ok) {
    const data = { state: initial };
    throw proveError("E1716", `${st.id}: initial breaks the schema or an invariant\n${JSON.stringify(data)}`, data);
  }
  const tools = await loadTools();
  for (const t of transactions) await step(tools, t, rlimit);
  return { proven: names, z3: tools.version };
}
