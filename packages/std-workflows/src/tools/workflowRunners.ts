import { type Finding, type RuleDef, defineRule } from "@keel/check";
import { runnersEdits } from "@keel/std-jobs/tools";
import { callsOf } from "./internal/callsOf.ts";
import { cut } from "./internal/cut.ts";
import { importsOf } from "./internal/importsOf.ts";
import { lineCol } from "./internal/lineCol.ts";
import { moduleFile } from "./internal/moduleFile.ts";

const DECL = /const\s+([\w$]+)\s*=\s*workflow\(/g;
const WF = "@keel/std-workflows";
const imp = (name: string, from: string): string => `import { ${name} } from "${from}"\n`;

/**
 * E2354 (std.workflows, k.check registry): a module with a workflow whose `queue` lacks the workflow's `jobs`, or
 * whose literal `runners` lack a `flows` holding it; the fix adds them, with their imports. A module with no
 * `jobs.server.ts` or `runners.server.ts` reports on the workflow's file, without a fix.
 */
export const workflowRunners: RuleDef = defineRule({
  code: "E2354",
  see: "std.workflows",
  message: (f) => {
    const n = cut(f.data?.name);
    return f.data?.where === "queue" ? `queue lacks workflow '${n}' jobs` : `runners lack flows for workflow '${n}'`;
  },
  explain:
    "A workflow runs through its module's queue and runners. " +
    "Fix: queue({ ...removal.jobs }); runners = [jobs, flows(jobs, [removal])].",
  check: ({ file, ast, project }): Finding[] => {
    const mf = moduleFile(file.path);
    if (mf === undefined) return [];
    const dir = `${mf.prefix}modules/${mf.id}/`;
    const flows = project
      .filter((f) => f.path.startsWith(dir) && f.path.endsWith(".server.ts"))
      .flatMap((f) =>
        [...f.source.matchAll(DECL)].map((m) => ({ name: m[1] ?? "", from: `./${f.path.slice(dir.length)}` })),
      );
    const out: Finding[] = [];
    const ims = importsOf(ast);
    const localOf = (from: string, name: string): string | undefined =>
      ims.find((i) => i.from === from.replace(/\.ts$/, "") && i.name === name)?.local;
    const add = (where: string, name: string, at?: number, text?: string, head?: string): void => {
      const data = at === undefined ? { where, name } : { where, name, at, text: text ?? "", head: head ?? "" };
      out.push({ path: file.path, ...lineCol(file.source, at ?? 0), data });
    };
    for (const w of flows) {
      if (w.from === `./${mf.rest}`)
        for (const where of ["jobs", "runners"])
          if (!project.some((f) => f.path === `${dir}${where}.server.ts`))
            add(where === "jobs" ? "queue" : where, w.name);
      const local = localOf(w.from, w.name);
      const n = local ?? w.name;
      const head = local === undefined ? imp(w.name, w.from) : "";
      if (mf.rest === "jobs.server.ts")
        for (const q of callsOf(ast, "@keel/std-jobs", "queue")) {
          const o = q.arguments[0];
          if (o?.type !== "ObjectExpression") continue;
          const has = RegExp(`\\.\\.\\.\\s*${n.replace(/\$/g, "\\$")}\\.jobs\\b`).test(
            file.source.slice(o.start, o.end),
          );
          const last = o.properties.at(-1);
          if (!has)
            add("queue", w.name, last ? last.end : o.start + 1, last ? `, ...${n}.jobs` : ` ...${n}.jobs `, head);
        }
      if (mf.rest !== "runners.server.ts") continue;
      for (const st of ast.body) {
        if (st.type !== "ExportNamedDeclaration" || st.declaration?.type !== "VariableDeclaration") continue;
        for (const d of st.declaration.declarations) {
          const list = d.init;
          if (d.id.type !== "Identifier" || d.id.name !== "runners" || list?.type !== "ArrayExpression") continue;
          const lists = callsOf(ast, WF, "flows")
            .filter((c) => c.start > list.start && c.end < list.end)
            .flatMap((c) => (c.arguments[1]?.type === "ArrayExpression" ? [c.arguments[1]] : []));
          if (lists.some((a) => a.elements.some((e) => e?.type === "Identifier" && e.name === n))) continue;
          const arr = lists[0];
          const last = (arr ?? list).elements.at(-1);
          const at = last ? last.end : (arr ?? list).start + 1;
          if (arr) add("runners", w.name, at, last ? `, ${n}` : n, head);
          else {
            const fl = localOf(WF, "flows");
            const jl = localOf("./jobs.server.ts", "jobs");
            const text = `${last ? ", " : ""}${fl ?? "flows"}(${jl ?? "jobs"}, [${n}])`;
            add(
              "runners",
              w.name,
              at,
              text,
              (fl ? "" : imp("flows", WF)) + (jl ? "" : imp("jobs", "./jobs.server.ts")) + head,
            );
          }
        }
      }
    }
    return out;
  },
  fix: runnersEdits,
});
