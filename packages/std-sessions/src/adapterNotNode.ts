import { defineRule } from "@keel/check";
import type { RuleDef } from "@keel/check";
import { servedOffNode } from "./internal/servedOffNode.ts";

const SOURCE = "@keel/std-sessions/routes";

/**
 * E2005 (std.sessions, k.check registry): a module's `routes.ts` imports or re-exports `@keel/std-sessions/routes`
 * (`import`, `import()` or `require()` with a literal specifier, `import x = require()`, `export { routes as sessions } from`, `export * from`, or through
 * other project files that do, read from `RuleInput.project`; a hop through a non-relative alias such as `@app/ops` is not followed) but a deployable serving that module has an adapter other than `node`. Reported at each
 * declaration of `routes.ts` that leads there. Reads the project's `topology.ts` statically; no fix.
 */
export const adapterNotNode: RuleDef = defineRule({
  code: "E2005",
  see: "std.sessions",
  message: (f) =>
    `deployable '${String(f.data?.deployable ?? "")}' (${String(f.data?.adapter ?? "")}) serves ${SOURCE}; ingest needs node`,
  explain:
    "the sessions ingest route needs a server. A deployable with adapter 'static' or 'client' cannot serve it. " +
    "Fix: topology({ web: { modules: ['cart'], adapter: 'node' } }), or drop the @keel/std-sessions/routes import.",
  check: (input) => servedOffNode(input, ["routes.ts"], SOURCE),
});
