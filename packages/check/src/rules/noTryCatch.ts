import { type Node, Visitor } from "oxc-parser";
import { ensureImport } from "../internal/ensureImport.ts";
import { findingAt } from "../internal/findingAt.ts";
import { isAppPath } from "../internal/isAppPath.ts";
import { num } from "../internal/num.ts";
import { str } from "../internal/str.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";

type Span = { start: number; end: number };

const inside = (x: Span, y: Span): boolean => x.start >= y.start && x.end <= y.end;

/** E1452 (k.errors): `try`/`catch` or `.catch()` in app code. Fix (`try`/`catch` in a function): `attempt`. */
export const noTryCatch: RuleDef = {
  code: "E1452",
  message: (f) =>
    str(f.data, "kind") === "catch"
      ? ".catch() in app code; use attempt(fn)"
      : "try/catch in app code; use attempt(fn)",
  explain: "attempt(fn) is the only sanctioned catch: it returns err('keel.unexpected') instead of throwing.",
  see: "k.errors",
  check: ({ file, ast }) => {
    if (!isAppPath(file.path)) return [];
    const out: Finding[] = [];
    const fns: Span[] = [];
    const awaits: Span[] = [];
    const returns: Span[] = [];
    const tries: { node: Span; block: Span; handler: Span; body: Span; param: string; finalizer: boolean }[] = [];
    const fn = (n: Node): void => void fns.push({ start: n.start, end: n.end });
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
        if (c.type === "MemberExpression" && !c.computed && c.property.name === "catch")
          out.push(findingAt(file, c.property.start, { kind: "catch" }));
      },
    }).visit(ast);
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
