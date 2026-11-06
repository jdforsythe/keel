import type { Topology } from "../types/Topology.ts";
import type { Located } from "./Located.ts";
import { codedError } from "./codedError.ts";

/**
 * Check the whole topology against the route table and pick the deployable to serve. E1552: a deployable
 * names a module no route belongs to, or one module is in two deployables. E1553: a `static` deployable
 * contains a route with params or actions. Returns the routes of the served deployable's modules.
 */
export function selectDeployable(
  topology: Topology,
  table: readonly Located[],
  routeModules: ReadonlySet<string>,
  name: string | undefined,
): readonly Located[] {
  const owner = new Map<string, string>();
  for (const [dep, d] of Object.entries(topology))
    for (const m of d.modules) {
      if (!routeModules.has(m)) throw codedError("E1552", `deployable ${dep} names unknown module ${m}`);
      const prev = owner.get(m);
      if (prev !== undefined) throw codedError("E1552", `module ${m} is in deployables ${prev} and ${dep}`);
      owner.set(m, dep);
    }
  const names = Object.keys(topology);
  const picked = name ?? (names.length === 1 ? names[0] : undefined);
  const dep = picked === undefined || !Object.hasOwn(topology, picked) ? undefined : topology[picked];
  if (picked === undefined || dep === undefined)
    throw codedError("E1552", `pass deployable: one of ${names.join(", ") || "(none)"}${name ? `, not ${name}` : ""}`);
  const served = table.filter((r) => dep.modules.includes(r.module));
  if (dep.adapter === "static")
    for (const r of served) {
      const params = r.def.params !== undefined || r.segments.some((s) => s.kind === "param");
      const actions = Object.keys(r.def.actions ?? {}).length > 0;
      if (params || actions)
        throw codedError("E1553", `static deployable ${picked}: route ${r.id} has ${params ? "params" : "actions"}`);
    }
  return served;
}
