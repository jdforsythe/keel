import { globalRefs } from "@keel/compiler/internal";
import { type Node, Visitor } from "oxc-parser";
import { catchMessage } from "../internal/catchMessage.ts";
import { ensureImport } from "../internal/ensureImport.ts";
import { finallyExits } from "../internal/finallyExits.ts";
import { findingAt } from "../internal/findingAt.ts";
import { isAppPath } from "../internal/isAppPath.ts";
import { num } from "../internal/num.ts";
import { str } from "../internal/str.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";

type Span = { start: number; end: number };

const inside = (x: Span, y: Span): boolean => x.start >= y.start && x.end <= y.end;

/**
 * E1452 (k.errors): `try`/`catch` in app code (fix, in a function: `attempt`), and a `return`, `break` or `continue`
 * leaving the `finally` holding it (no fix). The callee half (`.catch()`, a `.then()` given a second argument,
 * `Promise.allSettled`, `Promise.any`) is read here by spelling without the type pass, and by symbol in it
 * (`calleeUses`, k.unsafe One path).
 */
export const noTryCatch: RuleDef = {
  code: "E1452",
  message: (f) => catchMessage(str(f.data, "kind")),
  see: "k.errors",
  check: ({ file, ast, types }) => {
    if (!isAppPath(file.path)) return [];
    const out: Finding[] = [];
    const fns: Span[] = [];
    const awaits: Span[] = [];
    const returns: Span[] = [];
    const tries: { node: Span; block: Span; handler: Span; body: Span; param: string; finalizer: boolean }[] = [];
    const fn = (n: Node): void => void fns.push({ start: n.start, end: n.end });
    const g = types === true ? undefined : globalRefs(ast);
    const promiseAt = (at: number): boolean => g?.sameBinding("Promise", ast.start, at) === true;
    new Visitor({
      FunctionDeclaration: fn,
      FunctionExpression: fn,
      ArrowFunctionExpression: fn,
      AwaitExpression: (n) => void awaits.push(n),
      ReturnStatement: (n) => void returns.push(n),
      TryStatement: (n) => {
        if (n.handler === null) return;
        const p = n.handler.param;
        tries.push({
          node: n,
          block: n.block,
          handler: n.handler,
          body: n.handler.body,
          param: p?.type === "Identifier" ? p.name : p === null ? "" : "?",
          finalizer: n.finalizer !== null,
        });
      },
      CallExpression: (n) => {
        const c = n.callee;
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
    for (const at of finallyExits(ast)) out.push(findingAt(file, at, { kind: "finally" }));
    for (const t of tries) {
      const owner = fns.filter((f) => inside(t.node, f)).sort((a, b) => b.start - a.start)[0];
      const own = (s: Span): boolean => inside(s, t.block) && !fns.some((f) => inside(f, t.block) && inside(s, f));
      const fixable = owner !== undefined && !t.finalizer && t.param !== "?";
      out.push(
        findingAt(file, t.node.start, {
          kind: "try",
          start: t.node.start,
          end: t.node.end,
          blockStart: t.block.start,
          blockEnd: t.block.end,
          bodyStart: t.body.start,
          bodyEnd: t.body.end,
          param: t.param,
          fixable: fixable ? 1 : 0,
          returns: returns.some(own) ? 1 : 0,
          awaits: awaits.some(own) ? 1 : 0,
        }),
      );
    }
    return out;
  },
  fix: (f, { file, ast }) => {
    if (str(f.data, "kind") !== "try" || num(f.data, "fixable", 0) !== 1) return null;
    const d = f.data;
    const src = file.source;
    const start = num(d, "start");
    const indent = /^[ \t]*/.exec(src.slice(src.lastIndexOf("\n", start - 1) + 1, start))?.[0] ?? "";
    const block = src.slice(num(d, "blockStart"), num(d, "blockEnd"));
    const body = src.slice(num(d, "bodyStart"), num(d, "bodyEnd"));
    const multi = block.includes("\n") || body.includes("\n");
    const nl = multi ? `\n${indent}` : " ";
    const param = str(d, "param");
    const bound = param === "" ? body : `{${multi ? `${nl}  ` : " "}const ${param} = attempted.error;${body.slice(1)}`;
    const call = num(d, "awaits", 0) === 1 ? `await attempt(async () => ${block})` : `attempt(() => ${block})`;
    const onError =
      num(d, "returns", 0) === 1
        ? `if (attempted.ok) return attempted.value;${nl}${bound}`
        : `if (!attempted.ok) ${bound}`;
    return [
      ...ensureImport(ast, "attempt", "@keel/schema"),
      { start, end: num(d, "end"), text: `const attempted = ${call};${nl}${onError}` },
    ];
  },
};
