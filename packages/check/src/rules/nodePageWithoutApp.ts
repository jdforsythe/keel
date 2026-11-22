import { globalRefs } from "@keel/compiler/internal";
import { Visitor } from "oxc-parser";
import { findingAt } from "../internal/findingAt.ts";
import { isTestPath } from "../internal/isTestPath.ts";
import { keyName } from "../internal/keyName.ts";
import { localNames } from "../internal/modules/localNames.ts";
import { str } from "../internal/str.ts";
import { topologyFor } from "../internal/topologyFor.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";

/**
 * W1723 (k.testing): in a test file, `renderRoute` from `@keel/testing` (any alias) called with a literal route id
 * whose module prefix (before the first `.`) the project's `topology.ts` places in a `node` deployable, and an options
 * object literal with no `app` key (and no spread). The page then renders through a client router, which a built
 * `node` page never has. A non-literal id or options, or no readable topology, is none. No fix: the test builds `app`.
 */
export const nodePageWithoutApp: RuleDef = {
  code: "W1723",
  message: (f) => `renderRoute('${str(f.data, "id")}') renders a node page through a router; pass app`,
  see: "k.testing",
  check: ({ file, ast, project }) => {
    if (!isTestPath(file.path)) return [];
    const names = localNames(ast, "renderRoute", "@keel/testing");
    if (names.size === 0) return [];
    const topology = topologyFor(file.path, project)?.topology;
    if (topology === undefined) return [];
    const node = new Set<string>();
    for (const d of Object.values(topology)) if (d.adapter === "node") for (const m of d.modules) node.add(m);
    if (node.size === 0) return [];
    const g = globalRefs(ast);
    const out: Finding[] = [];
    new Visitor({
      CallExpression: (n) => {
        const c = n.callee;
        if (c.type !== "Identifier" || !names.has(c.name) || !g.sameBinding(c.name, ast.start, c.start)) return;
        const [idArg, opts] = n.arguments;
        if (idArg?.type !== "Literal" || typeof idArg.value !== "string" || opts?.type !== "ObjectExpression") return;
        if (opts.properties.some((p) => p.type === "SpreadElement" || p.computed || keyName(p) === "app")) return;
        if (node.has(idArg.value.split(".")[0] ?? "")) out.push(findingAt(file, idArg.start, { id: idArg.value }));
      },
    }).visit(ast);
    return out;
  },
};
