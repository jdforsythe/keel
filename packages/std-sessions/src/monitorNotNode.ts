import { defineRule } from "@keel/check";
import type { RuleDef } from "@keel/check";
import { servedOffNode } from "./internal/servedOffNode.ts";

const SOURCE = "@keel/std-sessions/monitor";

/**
 * E2009 (std.monitor, k.check registry): a module's `runners.server.ts` imports or re-exports
 * `@keel/std-sessions/monitor` (`monitor` in the runners; followed through project files as E2005 follows them) but a
 * deployable serving that module has an adapter other than `node`. Reported at each
 * declaration that leads there. Reads the project's `topology.ts` statically; no fix.
 */
export const monitorNotNode: RuleDef = defineRule({
  code: "E2009",
  see: "std.monitor",
  message: (f) =>
    `deployable '${String(f.data?.deployable ?? "")}' (${String(f.data?.adapter ?? "")}) serves ${SOURCE}; monitor needs node`,
  explain:
    "the tally runner needs a server. A deployable with adapter 'static' or 'client' cannot run them. " +
    "Fix: topology({ api: { modules: ['api'], adapter: 'node' } }), or drop the @keel/std-sessions/monitor import.",
  check: (input) => servedOffNode(input, ["runners.server.ts"], SOURCE),
});
