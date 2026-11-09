import { defineRule } from "@keel/check";
import type { Finding, RuleDef } from "@keel/check";
import { parseTopology } from "@keel/compiler";
import { lineCol } from "./internal/lineCol.ts";
import { moduleFile } from "./internal/moduleFile.ts";

const SOURCE = "@keel/std-sessions/routes";

/**
 * E2005 (std.sessions, k.check registry): a module's `routes.ts` imports `@keel/std-sessions/routes` but a deployable
 * serving that module has an adapter other than `node`. Reads the project's `topology.ts` statically; no fix.
 */
export const adapterNotNode: RuleDef = defineRule({
  code: "E2005",
  see: "std.sessions",
  message: (f) =>
    `deployable '${String(f.data?.deployable ?? "")}' (${String(f.data?.adapter ?? "")}) serves ${SOURCE}; ingest needs node`,
  explain:
    "the sessions ingest route needs a server. A deployable with adapter 'static' or 'client' cannot serve it. " +
    "Fix: topology({ web: { modules: ['cart'], adapter: 'node' } }), or drop the @keel/std-sessions/routes import.",
  check: ({ file, ast, project }) => {
    const mf = moduleFile(file.path);
    if (mf === undefined || mf.rest !== "routes.ts") return [];
    const imports = ast.body.filter((s) => s.type === "ImportDeclaration" && s.source.value === SOURCE);
    if (imports.length === 0) return [];
    const topo = project.find((f) => f.path === `${mf.prefix}topology.ts`);
    if (topo === undefined) return [];
    const bad = Object.entries(parseTopology(topo.source).topology).find(
      ([, d]) => d.adapter !== "node" && d.modules.includes(mf.id),
    );
    if (bad === undefined) return [];
    const out: Finding[] = [];
    for (const imp of imports) {
      if (imp.type !== "ImportDeclaration") continue;
      out.push({
        path: file.path,
        ...lineCol(file.source, imp.source.start),
        data: { deployable: bad[0], adapter: bad[1].adapter },
      });
    }
    return out;
  },
});
