import { type Finding, type RuleDef, defineRule } from "@keel/check";
import { callsOf } from "./internal/callsOf.ts";
import { holdsSecretCall } from "./internal/holdsSecretCall.ts";
import { isAppFile } from "./internal/isAppFile.ts";
import { lineCol } from "./internal/lineCol.ts";

/**
 * E2602 (std.channels, k.check registry): a `channel` whose `message` schema, inline or a `const` of the same file,
 * holds `s.secret`. A message reaches every member's browser as published. No fix; `channel` also throws it.
 */
export const secretMessage: RuleDef = defineRule({
  code: "E2602",
  see: "std.channels",
  message: "channel message holds s.secret; every member receives a message as sent",
  explain:
    "A channel message reaches every member's browser as published, so its schema holds no secret. " +
    "Fix: publish an id members re-read through their own loader: message: s.object({ noteId: s.id('Note') }).",
  check: ({ file, ast }): Finding[] => {
    if (!isAppFile(file.path)) return [];
    const consts = new Map<string, unknown>();
    for (const st of ast.body) {
      const decl = st.type === "ExportNamedDeclaration" ? st.declaration : st;
      if (decl?.type !== "VariableDeclaration") continue;
      for (const d of decl.declarations) if (d.id.type === "Identifier") consts.set(d.id.name, d.init);
    }
    const out: Finding[] = [];
    for (const c of callsOf(ast, "@keel/std-channels", "channel")) {
      const opts = c.arguments[1];
      if (opts?.type !== "ObjectExpression") continue;
      for (const p of opts.properties) {
        if (p.type !== "Property" || p.computed || p.key.type !== "Identifier" || p.key.name !== "message") continue;
        const v = p.value;
        if (holdsSecretCall(v.type === "Identifier" ? consts.get(v.name) : v))
          out.push({ path: file.path, ...lineCol(file.source, v.start) });
      }
    }
    return out;
  },
});
