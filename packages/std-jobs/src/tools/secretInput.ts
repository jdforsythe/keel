import { type Finding, type RuleDef, defineRule } from "@keel/check";
import { callsOf } from "./internal/callsOf.ts";
import { holdsSecretCall } from "./internal/holdsSecretCall.ts";
import { lineCol } from "./internal/lineCol.ts";
import { propOf } from "./internal/propOf.ts";

/**
 * E2503 (std.jobs, k.check registry): a `job` whose `input` schema, inline or a `const` of the same file, holds
 * `s.secret` (`s` from `@keel/schema`), with `job` named or reached through a namespace import. A job's input is stored. No fix; `queue` also throws it.
 */
export const secretInput: RuleDef = defineRule({
  code: "E2503",
  see: "std.jobs",
  message: "job input holds s.secret; a job's input is stored",
  explain:
    "Job inputs are stored, so they hold no secret. " +
    "Fix: pass an id the job reads it by: job({ input: s.object({ userId: s.id('User') }) }, fn).",
  check: ({ file, ast }): Finding[] => {
    const consts = new Map<string, unknown>();
    for (const st of ast.body) {
      const decl = st.type === "ExportNamedDeclaration" ? st.declaration : st;
      if (decl?.type !== "VariableDeclaration") continue;
      for (const d of decl.declarations) if (d.id.type === "Identifier") consts.set(d.id.name, d.init);
    }
    const schemas = new Set<string>();
    for (const st of ast.body)
      if (st.type === "ImportDeclaration" && st.source.value === "@keel/schema")
        for (const sp of st.specifiers)
          if (
            sp.type === "ImportSpecifier" &&
            (sp.imported.type === "Identifier" ? sp.imported.name : sp.imported.value) === "s"
          )
            schemas.add(sp.local.name);
    const out: Finding[] = [];
    for (const c of callsOf(ast, "@keel/std-jobs", "job")) {
      const a = c.arguments[0];
      const input = propOf(a?.type === "ObjectExpression" ? a : undefined, "input");
      if (input === undefined) continue;
      if (holdsSecretCall(input.type === "Identifier" ? consts.get(input.name) : input, schemas))
        out.push({ path: file.path, ...lineCol(file.source, input.start) });
    }
    return out;
  },
});
