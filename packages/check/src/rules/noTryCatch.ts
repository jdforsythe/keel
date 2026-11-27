import { globalRefs } from "@keel/compiler/internal";
import { type Node, Visitor } from "oxc-parser";
import { catchMessage } from "../internal/catchMessage.ts";
import { finallyExits } from "../internal/finallyExits.ts";
import { findingAt } from "../internal/findingAt.ts";
import { isAppPath } from "../internal/isAppPath.ts";
import { num } from "../internal/num.ts";
import { schemaCallee } from "../internal/schemaCallee.ts";
import { str } from "../internal/str.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";

type Span = { readonly start: number; readonly end: number };
type Exit = Span & { readonly kind: "return" | "break" | "continue"; readonly label?: string };

const inside = (x: Span, y: Span): boolean => x.start >= y.start && x.end <= y.end;

/**
 * E1452 (k.errors, k.attempt): `try`/`catch` in app code, at the `try` keyword; a `return`, `break` or `continue`
 * leaving the `finally` holding it; a `defect` call in a `finally` block outside a function nested in it; `attempt`
 * with one argument; an `expect` written as a function with no parameter, a `_`-named one or one its body never uses.
 * The callee half (`.catch()`, a `.then()` given a second argument, `Promise.allSettled`, `Promise.any`) and `defect` in
 * `finally` are read here by spelling without the type pass, and by symbol in it (`calleeUses`, k.unsafe One path).
 * Fix (k.fixes Per code): only cleanup and rethrow, `try { A } catch (e) { B; throw e }`, becomes
 * `let done = false; try { A; done = true } finally { if (!done) { B } }`, `done` a name free in the function; with
 * `B` empty, `A`'s statements alone.
 */
export const noTryCatch: RuleDef = {
  code: "E1452",
  message: (f) => catchMessage(str(f.data, "kind")),
  see: "k.errors",
  check: ({ file, ast, types }) => {
    if (!isAppPath(file.path)) return [];
    const out: Finding[] = [];
    const fns: Span[] = [];
    const loops: Span[] = [];
    const switches: Span[] = [];
    const labels: (Span & { name: string })[] = [];
    const exits: Exit[] = [];
    const yields: Span[] = [];
    const idents: (Span & { name: string })[] = [];
    const listed = new Set<number>();
    const finals: Span[] = [];
    const defects: number[] = [];
    const tries: Node[] = [];
    const attempts: Node[] = [];
    const g = types === true ? undefined : globalRefs(ast);
    const promiseAt = (at: number): boolean => g?.sameBinding("Promise", ast.start, at) === true;
    const isDefect = schemaCallee(ast, "defect");
    const isAttempt = schemaCallee(ast, "attempt");
    const fn = (n: Span): void => void fns.push(n);
    const loop = (n: Span): void => void loops.push(n);
    const list = (body: readonly Span[]): void => {
      for (const s of body) listed.add(s.start);
    };
    new Visitor({
      Program: (n) => list(n.body),
      BlockStatement: (n) => list(n.body),
      StaticBlock: (n) => list(n.body),
      SwitchCase: (n) => list(n.consequent),
      FunctionDeclaration: fn,
      FunctionExpression: fn,
      ArrowFunctionExpression: fn,
      ForStatement: loop,
      ForInStatement: loop,
      ForOfStatement: loop,
      WhileStatement: loop,
      DoWhileStatement: loop,
      SwitchStatement: (n) => void switches.push(n),
      LabeledStatement: (n) => void labels.push({ start: n.start, end: n.end, name: n.label.name }),
      ReturnStatement: (n) => void exits.push({ start: n.start, end: n.end, kind: "return" }),
      BreakStatement: (n) =>
        void exits.push(
          n.label === null
            ? { start: n.start, end: n.end, kind: "break" }
            : { start: n.start, end: n.end, kind: "break", label: n.label.name },
        ),
      ContinueStatement: (n) =>
        void exits.push(
          n.label === null
            ? { start: n.start, end: n.end, kind: "continue" }
            : { start: n.start, end: n.end, kind: "continue", label: n.label.name },
        ),
      YieldExpression: (n) => void yields.push(n),
      Identifier: (n) => void idents.push({ name: n.name, start: n.start, end: n.end }),
      TryStatement: (n) => {
        if (n.finalizer !== null) finals.push(n.finalizer);
        if (n.handler !== null) tries.push(n);
      },
      CallExpression: (n) => {
        const c = n.callee;
        if (types !== true && isDefect(c)) defects.push(c.start);
        if (isAttempt(c)) attempts.push(n);
        if (types === true || c.type !== "MemberExpression" || c.computed) return;
        const name = c.property.name;
        if (name === "catch" || (name === "then" && n.arguments.length >= 2))
          out.push(findingAt(file, c.property.start, { kind: name }));
        else if (
          (name === "allSettled" || name === "any") &&
          c.object.type === "Identifier" &&
          c.object.name === "Promise" &&
          promiseAt(c.object.start)
        )
          out.push(findingAt(file, c.property.start, { kind: name }));
      },
    }).visit(ast);
    for (const n of attempts) {
      if (n.type !== "CallExpression") continue;
      const [first, expect] = n.arguments;
      if (n.arguments.length === 1 && first?.type !== "SpreadElement")
        out.push(findingAt(file, n.start, { kind: "attempt" }));
      else if (expect?.type === "ArrowFunctionExpression" || expect?.type === "FunctionExpression") {
        const p = expect.params[0];
        const body = expect.body;
        const untested =
          p === undefined ||
          (p.type === "Identifier" &&
            (p.name.startsWith("_") || body === null || !idents.some((i) => i.name === p.name && inside(i, body))));
        if (untested) out.push(findingAt(file, expect.start, { kind: "expect" }));
      }
    }
    for (const at of finallyExits(ast)) out.push(findingAt(file, at, { kind: "finally" }));
    const nested = (x: Span, within: Span): boolean => fns.some((f) => inside(f, within) && inside(x, f));
    for (const at of defects) {
      const here = { start: at, end: at + 1 };
      // A `return` in the `finally` is its own E1452 (`finallyExits`), the one diagnostic of that statement.
      const returned = (b: Span): boolean =>
        exits.some((e) => e.kind === "return" && inside(here, e) && inside(e, b) && !nested(e, b));
      if (finals.some((b) => inside(here, b) && !nested(here, b) && !returned(b)))
        out.push(findingAt(file, at, { kind: "defect-finally" }));
    }
    for (const t of tries) out.push(tryFinding(t));
    return out;

    function tryFinding(t: Node): Finding {
      const base = findingAt(file, t.start, { kind: "try" });
      if (t.type !== "TryStatement" || t.handler === null || t.finalizer !== null || !listed.has(t.start)) return base;
      const param = t.handler.param;
      const stmts = t.handler.body.body;
      const last = stmts[stmts.length - 1];
      if (param?.type !== "Identifier" || last?.type !== "ThrowStatement") return base;
      if (last.argument.type !== "Identifier" || last.argument.name !== param.name) return base;
      const b: Span = { start: stmts[0]?.start ?? last.start, end: last.start };
      if (idents.some((i) => i.name === param.name && i.start >= b.start && i.start < b.end)) return base;
      const block = t.block;
      const leaves = (e: Exit): boolean => {
        if (!inside(e, block) || nested(e, block)) return false;
        if (e.kind === "return") return true;
        if (e.label !== undefined) return !labels.some((l) => l.name === e.label && inside(l, block) && inside(e, l));
        const targets = e.kind === "break" ? [...loops, ...switches] : loops;
        return !targets.some((l) => inside(l, block) && inside(e, l));
      };
      if (exits.some(leaves) || yields.some((y) => inside(y, block) && !nested(y, block))) return base;
      const emptyB = stmts.length === 1;
      const declares = block.body.some(
        (s) =>
          (s.type === "VariableDeclaration" && s.kind !== "var") ||
          s.type === "ClassDeclaration" ||
          s.type === "FunctionDeclaration",
      );
      if (emptyB && declares) return base;
      const owner = fns.filter((f) => inside(t, f)).sort((x, y) => y.start - x.start)[0] ?? ast;
      const taken = new Set(idents.filter((i) => i.start >= owner.start && i.start < owner.end).map((i) => i.name));
      let flag = "done";
      for (let k = 2; taken.has(flag); k++) flag = `done${k}`;
      return findingAt(file, t.start, {
        kind: "try",
        fixable: 1,
        start: t.start,
        end: t.end,
        blockStart: block.start,
        blockEnd: block.end,
        bStart: b.start,
        bEnd: emptyB ? b.start : (stmts[stmts.length - 2]?.end ?? b.start),
        flag,
      });
    }
  },
  fix: (f, { file }) => {
    if (str(f.data, "kind") !== "try" || num(f.data, "fixable", 0) !== 1) return null;
    const d = f.data;
    const src = file.source;
    const start = num(d, "start");
    const lineStart = src.lastIndexOf("\n", start - 1) + 1;
    const lead = src.slice(lineStart, start);
    const indent = /^[ \t]*/.exec(lead)?.[0] ?? "";
    const own = lead.trim() === "";
    const a = src
      .slice(num(d, "blockStart") + 1, num(d, "blockEnd") - 1)
      .trim()
      .replace(/;$/, "");
    const b = src.slice(num(d, "bStart"), num(d, "bEnd")).trim().replace(/;$/, "");
    const end = num(d, "end");
    if (b === "") return [{ start, end, text: a }];
    const flag = str(d, "flag");
    const multi = a.includes("\n") || b.includes("\n");
    const text = multi
      ? `let ${flag} = false\n${indent}try {\n${indent}  ${a}\n${indent}  ${flag} = true\n${indent}} finally {\n${indent}  if (!${flag}) {\n${indent}    ${b}\n${indent}  }\n${indent}}`
      : `let ${flag} = false${own ? `\n${indent}` : "; "}try { ${a}${a.endsWith("}") ? " " : "; "}${flag} = true } finally { if (!${flag}) { ${b} } }`;
    return [{ start, end, text }];
  },
};
