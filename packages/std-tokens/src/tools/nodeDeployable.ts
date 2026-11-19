import { type Finding, type RuleDef, defineRule } from "@keel/check";
import { parseTopology } from "@keel/compiler";
import { lineCol } from "./internal/lineCol.ts";
import { serverImports } from "./internal/serverImports.ts";

const MODULE = /^((?:.*\/)?)modules\/([^/]+)\/.+$/;

/**
 * E2202 (std.tokens, k.check registry): `@keel/std-tokens/server` imported in a module that `topology.ts`
 * places in a deployable whose adapter is not `node`; data `{ deployable, adapter }`. No fix.
 */
export const nodeDeployable: RuleDef = defineRule({
  code: "E2202",
  see: "std.tokens",
  message: (f) =>
    `tokens need a node deployable; '${String(f.data?.deployable).slice(0, 24)}' is ${String(f.data?.adapter)}`,
  explain:
    "mint and check run on node:crypto, which a browser, a static build and a shell do not have. " +
    "Fix: place the module in a node deployable (keel codemod place) and call its action from the client.",
  check: ({ file, ast, project }): Finding[] => {
    const m = MODULE.exec(file.path);
    if (m === null) return [];
    const found = serverImports(ast);
    const topo = project.find((f) => f.path === `${m[1] ?? ""}topology.ts`);
    if (found.length === 0 || topo === undefined) return [];
    const id = m[2] ?? "";
    const out: Finding[] = [];
    for (const [deployable, d] of Object.entries(parseTopology(topo.source).topology))
      if (d.adapter !== "node" && d.modules.includes(id))
        for (const at of found)
          out.push({ path: file.path, ...lineCol(file.source, at), data: { deployable, adapter: d.adapter } });
    return out;
  },
});
