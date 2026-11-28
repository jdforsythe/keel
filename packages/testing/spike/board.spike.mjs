// Spike (not shipped API): golden-1's six board obligations as Z3 induction checks, encoded by hand in the SMT-LIB the
// `prove` translator emits. Run from packages/testing: `node spike/board.spike.mjs [runs] [--whole]`.
// `hideList` and `showList` are the planned transactions (TodoList gains `hidden: s.boolean().optional()`):
// `state.lists.some((l) => l.id === p.id) ? { ...state, lists: state.lists.map((l) => (l.id === p.id ? { ...l, hidden: true } : l)) } : state`.
// Encoding: strings and ids one uninterpreted sort `Str`; enums finite datatypes; records datatypes; an optional field an
// option datatype; an array a length >= 0 and an `(Array Int T)` index map; `.some` an `exists` over the index range,
// `.every` a `forall`, `new Set(a.map(f)).size === a.length` pairwise-distinct values over the range, `.has(x)` an
// `exists`; spread-append a `store` at the length; `.map` a `lambda`. By default one check per return path (its guard
// asserted) and per top-level conjunct of the invariant; `--whole` checks each transaction's whole `ite` against the
// whole invariant at once. A counterexample is searched with every array length bounded by B = 0..3 first (the
// unbounded check cannot build a model over the quantified invariant); the unbounded check is the proof.
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const runs = Number(process.argv[2] ?? "3");
const whole = process.argv.includes("--whole");
const RLIMIT = 10_000_000;

const PRELUDE = `(set-option :smt.random_seed 0)
(set-option :rlimit ${RLIMIT})
(declare-sort Str 0)
(declare-datatypes ((Pri 0)) (((low) (normal) (high))))
(declare-datatypes ((OptBool 0)) (((none) (some (some.v Bool)))))
(declare-datatypes ((TodoList 0)) (((TodoList (l.id Str) (l.name Str) (l.hidden OptBool)))))
(declare-datatypes ((Todo 0)) (((Todo (t.id Str) (t.listId Str) (t.title Str) (t.priority Pri) (t.done Bool)))))
(declare-datatypes ((ListArr 0)) (((ListArr (la.len Int) (la.at (Array Int TodoList))))))
(declare-datatypes ((TodoArr 0)) (((TodoArr (ta.len Int) (ta.at (Array Int Todo))))))
(declare-datatypes ((Board 0)) (((Board (b.lists ListArr) (b.todos TodoArr)))))
(define-fun wf ((s Board)) Bool (and (<= 0 (la.len (b.lists s))) (<= 0 (ta.len (b.todos s)))))
(define-fun lid ((L ListArr) (i Int)) Str (l.id (select (la.at L) i)))
(define-fun tid ((T TodoArr) (i Int)) Str (t.id (select (ta.at T) i)))
(define-fun tlist ((T TodoArr) (i Int)) Str (t.listId (select (ta.at T) i)))
(define-fun inv0 ((s Board)) Bool (let ((L (b.lists s))) (forall ((i Int) (j Int)) (=> (and (<= 0 i) (< i j) (< j (la.len L))) (not (= (lid L i) (lid L j)))))))
(define-fun inv1 ((s Board)) Bool (let ((T (b.todos s))) (forall ((i Int) (j Int)) (=> (and (<= 0 i) (< i j) (< j (ta.len T))) (not (= (tid T i) (tid T j)))))))
(define-fun inv2 ((s Board)) Bool (let ((L (b.lists s)) (T (b.todos s))) (forall ((i Int)) (=> (and (<= 0 i) (< i (ta.len T))) (exists ((k Int)) (and (<= 0 k) (< k (la.len L)) (= (lid L k) (tlist T i))))))))
(declare-const s Board)
(assert (wf s))
(assert (inv0 s))
(assert (inv1 s))
(assert (inv2 s))
`;
const GOALS = whole
  ? ["(and (wf post) (inv0 post) (inv1 post) (inv2 post))"]
  : ["(wf post)", "(inv0 post)", "(inv1 post)", "(inv2 post)"];
const D = (decls) => decls.map((d) => `(declare-const ${d})`).join("");
const hasL = "(exists ((i Int)) (and (<= 0 i) (< i (la.len (b.lists s))) (= (lid (b.lists s) i) p.id)))";
const hasT = "(exists ((i Int)) (and (<= 0 i) (< i (ta.len (b.todos s))) (= (tid (b.todos s) i) p.id)))";
const known = "(exists ((i Int)) (and (<= 0 i) (< i (la.len (b.lists s))) (= (lid (b.lists s) i) p.listId)))";
const appL =
  "(Board (ListArr (+ (la.len (b.lists s)) 1) (store (la.at (b.lists s)) (la.len (b.lists s)) (TodoList p.id p.name none))) (b.todos s))";
const appT =
  "(Board (b.lists s) (TodoArr (+ (ta.len (b.todos s)) 1) (store (ta.at (b.todos s)) (ta.len (b.todos s)) (Todo p.id p.listId p.title p.priority false))))";
const mapT = (upd) =>
  `(Board (b.lists s) (TodoArr (ta.len (b.todos s)) (lambda ((i Int)) (let ((t (select (ta.at (b.todos s)) i))) (ite (= (t.id t) p.id) ${upd} t)))))`;
const mapL = (h) =>
  `(Board (ListArr (la.len (b.lists s)) (lambda ((i Int)) (let ((l (select (la.at (b.lists s)) i))) (ite (= (l.id l) p.id) (TodoList (l.id l) (l.name l) (some ${h})) l)))) (b.todos s))`;
const TODO_P = ["p.id Str", "p.listId Str", "p.title Str", "p.priority Pri"];
const addTodoGuard = `(or ${hasT} (not ${known}))`;

/** Each obligation: payload declarations and its return paths as [guard, post-state]. */
const OBLIGATIONS = {
  addList: [
    ["p.id Str", "p.name Str"],
    [
      [hasL, "s"],
      [`(not ${hasL})`, appL],
    ],
  ],
  addTodo: [
    TODO_P,
    [
      [addTodoGuard, "s"],
      [`(not ${addTodoGuard})`, appT],
    ],
  ],
  toggleTodo: [
    ["p.id Str"],
    [
      [hasT, mapT("(Todo (t.id t) (t.listId t) (t.title t) (t.priority t) (not (t.done t)))")],
      [`(not ${hasT})`, "s"],
    ],
  ],
  editTodo: [
    ["p.id Str", "p.title Str", "p.priority Pri"],
    [
      [hasT, mapT("(Todo (t.id t) (t.listId t) p.title p.priority (t.done t))")],
      [`(not ${hasT})`, "s"],
    ],
  ],
  hideList: [
    ["p.id Str"],
    [
      [hasL, mapL("true")],
      [`(not ${hasL})`, "s"],
    ],
  ],
  showList: [
    ["p.id Str"],
    [
      [hasL, mapL("false")],
      [`(not ${hasL})`, "s"],
    ],
  ],
  // the eval's planted negative: addTodo without its duplicate-id check
  "addTodo, no duplicate check": [
    TODO_P,
    [
      [`(not ${known})`, "s"],
      [known, appT],
    ],
  ],
};
/** `--whole`: one path, the transaction's `ite` as written. */
const wholePaths = ([decls, paths]) => {
  const [[guard, then], [, other]] = paths;
  return [decls, [["true", `(ite ${guard} ${then} ${other})`]]];
};
const BOUND = (b) => `(assert (<= (la.len (b.lists s)) ${b}))(assert (<= (ta.len (b.todos s)) ${b}))`;
const MODEL =
  "(get-value ((la.len (b.lists s)) (ta.len (b.todos s)) (select (la.at (b.lists s)) 0) (select (ta.at (b.todos s)) 0) (select (ta.at (b.todos s)) 1) p.id))";

const t0 = performance.now();
const { init } = require("z3-solver");
const { Z3 } = await init();
const loadMs = performance.now() - t0;
const out = (line) => process.stdout.write(`${line}\n`);
out(`z3 ${Z3.get_full_version()}; wasm load ${loadMs.toFixed(0)} ms; ${whole ? "whole" : "split"}`);

const check = async (text, extra) => {
  const c = Z3.mk_context(Z3.mk_config());
  const verdict = (await Z3.eval_smtlib2_string(c, text)).trim();
  const stats = await Z3.eval_smtlib2_string(c, "(get-info :all-statistics)");
  const more = verdict === "sat" && extra !== undefined ? await Z3.eval_smtlib2_string(c, extra) : "";
  Z3.del_context(c);
  return {
    verdict,
    rlimit: Number(/:rlimit-count\s+(\d+)/.exec(stats)?.[1] ?? "0"),
    model: more.replace(/\s+/g, " "),
  };
};

/** One obligation: bounded counterexample search, then the unbounded proof, per path and goal. */
const obligation = async ([decls, paths]) => {
  let rlimit = 0;
  let checks = 0;
  for (const [guard, post] of paths)
    for (const goal of GOALS) {
      const base = `${PRELUDE}${D(decls)}(assert ${guard})(define-fun post () Board ${post})(assert (not ${goal}))`;
      for (const b of [0, 1, 2, 3]) {
        const r = await check(`${base}${BOUND(b)}(check-sat)`, MODEL);
        rlimit += r.rlimit;
        checks += 1;
        if (r.verdict === "sat") return { verdict: "counterexample", rlimit, checks, model: r.model };
      }
      const r = await check(`${base}(check-sat)`, MODEL);
      rlimit += r.rlimit;
      checks += 1;
      if (r.verdict !== "unsat") return { verdict: r.verdict, rlimit, checks, model: r.model };
    }
  return { verdict: "proved", rlimit, checks, model: "" };
};

const B0 =
  "(Board (ListArr 0 ((as const (Array Int TodoList)) (TodoList p0 p0 none))) (TodoArr 0 ((as const (Array Int Todo)) (Todo p0 p0 p0 low false))))";
const INITIAL = `${PRELUDE.split("(declare-const s Board)")[0]}(declare-const p0 Str)(assert (not (and (inv0 ${B0}) (inv1 ${B0}) (inv2 ${B0}))))`;

const results = new Map();
for (let r = 0; r < runs; r++) {
  const all = [
    ...Object.entries(OBLIGATIONS).map(([n, o]) => [n, () => obligation(whole ? wholePaths(o) : o)]),
    [
      "initial",
      async () => {
        const x = await check(`${INITIAL}(check-sat)`);
        return { verdict: x.verdict === "unsat" ? "proved" : x.verdict, rlimit: x.rlimit, checks: 1, model: "" };
      },
    ],
  ];
  for (const [name, run] of all) {
    const a = performance.now();
    const res = await run();
    const ms = performance.now() - a;
    const prev = results.get(name);
    if (prev === undefined) results.set(name, { first: res, ms: [ms], same: true });
    else {
      prev.ms.push(ms);
      if (JSON.stringify(prev.first) !== JSON.stringify(res)) prev.same = false;
    }
  }
}
for (const [name, r] of results)
  out(
    `${name}: ${r.first.verdict}, ${r.first.checks} checks, rlimit ${r.first.rlimit}, ms ${r.ms.map((m) => m.toFixed(0)).join("/")}, ${r.same ? "same each run" : "DIFFERS"}${r.first.model ? `; model ${r.first.model}` : ""}`,
  );
out(`rss ${(process.memoryUsage().rss / 1e6).toFixed(0)} MB`);
process.exit(0);
