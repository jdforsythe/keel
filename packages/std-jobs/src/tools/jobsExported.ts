import { type Finding, type RuleDef, defineRule } from "@keel/check";
import { editOf } from "./internal/editOf.ts";
import { lineCol } from "./internal/lineCol.ts";
import { moduleFile } from "./internal/moduleFile.ts";
import { propOf } from "./internal/propOf.ts";

/**
 * E2502 (std.jobs, k.check registry): `jobs` in the `public.exports` of a module with `jobs.server.ts`. Another module
 * starts a job through one of this module's actions, never its queue. The fix removes the entry.
 */
export const jobsExported: RuleDef = defineRule({
  code: "E2502",
  see: "std.jobs",
  message: "jobs is public; other modules start jobs through this module's actions",
  explain:
    "A queue runs only in its module's deployable; other modules call its actions. " +
    "Fix: exports: ['jobs', 'Order'] -> exports: ['Order'].",
  check: ({ file, ast, project }): Finding[] => {
    const mf = moduleFile(file.path);
    if (mf?.rest !== "module.ts" || !project.some((f) => f.path === `${mf.prefix}modules/${mf.id}/jobs.server.ts`))
      return [];
    for (const st of ast.body) {
      if (st.type !== "ExportDefaultDeclaration") continue;
      const d = st.declaration;
      const arg = d.type === "CallExpression" ? d.arguments[0] : d;
      const list = propOf(propOf(arg?.type === "ObjectExpression" ? arg : undefined, "public"), "exports");
      if (list?.type !== "ArrayExpression") return [];
      const els = list.elements;
      const i = els.findIndex((e) => e?.type === "Literal" && e.value === "jobs");
      const e = els[i];
      if (!e) return [];
      const prev = els[i - 1];
      const next = els[i + 1];
      const [start, end] = prev ? [prev.end, e.end] : next ? [e.start, next.start] : [e.start, e.end];
      return [{ path: file.path, ...lineCol(file.source, e.start), data: { start, end, text: "" } }];
    }
    return [];
  },
  fix: editOf,
});
