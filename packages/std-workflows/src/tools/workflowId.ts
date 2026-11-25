import { type Finding, type RuleDef, defineRule } from "@keel/check";
import { callsOf, editOf, lineCol, moduleFile } from "@keel/std-jobs/tools";
import { cut } from "./internal/cut.ts";

/**
 * E2351 (std.workflows, k.check registry): a `workflow` call outside `*.server.ts`, or one whose id is not prefixed by
 * its module id. The fix prefixes the id.
 */
export const workflowId: RuleDef = defineRule({
  code: "E2351",
  see: "std.workflows",
  message: (f) =>
    f.data?.id === undefined
      ? "workflow outside *.server.ts"
      : `workflow id '${cut(f.data.id)}' is not prefixed by module '${cut(f.data.mod)}'`,
  explain:
    "A workflow lives in a module's *.server.ts, its id prefixed by the module id. " +
    "Fix: 'removal' -> 'api.removal'.",
  check: ({ file, ast }): Finding[] => {
    const mf = moduleFile(file.path);
    const out: Finding[] = [];
    for (const c of callsOf(ast, "@keel/std-workflows", "workflow")) {
      const a = c.arguments[0];
      if (!file.path.endsWith(".server.ts")) out.push({ path: file.path, ...lineCol(file.source, c.start) });
      else if (mf && a?.type === "Literal" && typeof a.value === "string" && !a.value.startsWith(`${mf.id}.`))
        out.push({
          path: file.path,
          ...lineCol(file.source, a.start),
          data: { id: a.value, mod: mf.id, start: a.start + 1, end: a.start + 1, text: `${mf.id}.` },
        });
    }
    return out;
  },
  fix: editOf,
});
