import { type Finding, type RuleDef, carriesReveal, defineRule } from "@keel/check";
import { type Expression, Visitor } from "oxc-parser";
import { callsOf } from "./internal/callsOf.ts";
import { lineCol } from "./internal/lineCol.ts";

/** A relative specifier of a module's queue file: `jobs.server` with `.ts`, `.js` or no extension. */
const JOBS_FILE = /^\.\.?\/(?:.*\/)?jobs\.server(?:\.[jt]s)?$/;

/**
 * E2506 (std.jobs, k.check registry): an argument of `<q>.enqueue(…)` that carries a value `reveal` returns
 * (`carriesReveal`, k.privacy-reads), `<q>` a name imported from a relative `jobs.server` file, `<ns>.<name>` of a
 * namespace import of one, or a `const` of the file bound to `queue(…)`. One finding per call, at it. A job's input
 * and `key` are stored. Not followed: `enqueue` taken into a local, its `.call` or `.apply`, a helper that enqueues.
 * No fix.
 */
export const revealedEnqueue: RuleDef = defineRule({
  code: "E2506",
  see: "std.jobs",
  message: "revealed value given to enqueue; a job's input and key are stored",
  explain:
    "A job's input and key are stored as written, so a revealed secret would sit in storage in plain text. " +
    "Fix: pass an id the job reads the value by: jobs.enqueue(ctx, 'orders.mail', { tokenId: minted.value.id }).",
  check: (input): Finding[] => {
    const { file, ast } = input;
    const named = new Set<string>();
    const spaces = new Set<string>();
    for (const st of ast.body) {
      if (st.type !== "ImportDeclaration" || st.importKind === "type" || !JOBS_FILE.test(st.source.value)) continue;
      for (const sp of st.specifiers)
        if (sp.type === "ImportNamespaceSpecifier") spaces.add(sp.local.name);
        else if (sp.type === "ImportDefaultSpecifier" || sp.importKind !== "type") named.add(sp.local.name);
    }
    const queues = new Set(callsOf(ast, "@keel/std-jobs", "queue").map((c) => c.start));
    if (queues.size > 0)
      new Visitor({
        VariableDeclaration: (d) => {
          if (d.kind !== "const") return;
          for (const v of d.declarations)
            if (v.id.type === "Identifier" && v.init?.type === "CallExpression" && queues.has(v.init.start))
              named.add(v.id.name);
        },
      }).visit(ast);
    if (named.size === 0 && spaces.size === 0) return [];
    const isQueue = (q: Expression): boolean =>
      q.type === "Identifier"
        ? named.has(q.name)
        : q.type === "MemberExpression" && !q.computed && q.object.type === "Identifier" && spaces.has(q.object.name);
    const out: Finding[] = [];
    new Visitor({
      CallExpression: (call) => {
        const c = call.callee;
        if (c.type !== "MemberExpression" || c.computed || c.property.name !== "enqueue" || !isQueue(c.object)) return;
        if (call.arguments.some((a) => carriesReveal(a, input)))
          out.push({ path: file.path, ...lineCol(file.source, call.start) });
      },
    }).visit(ast);
    return out;
  },
});
