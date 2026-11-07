import type { Topology } from "@keel/compiler";
import type { Located } from "@keel/router/internal";
import { codedError } from "./codedError.ts";
import { moduleOf } from "./moduleOf.ts";

/**
 * Pick the deployable to serve and validate it. E1552: one module is in two deployables (whole topology), or
 * the served deployable names a module no route belongs to (other deployables' modules are ignored; they
 * may be loaded by another process). E1553: a `static` deployable contains a route with params or actions.
 * Returns the routes of the served deployable's modules.
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
      const prev = owner.get(m);
      if (prev !== undefined) throw codedError("E1552", `module ${m} is in deployables ${prev} and ${dep}`);
      owner.set(m, dep);
    }
  const names = Object.keys(topology);
  const picked = name ?? (names.length === 1 ? names[0] : undefined);
  const dep = picked === undefined || !Object.hasOwn(topology, picked) ? undefined : topology[picked];
  if (picked === undefined || dep === undefined)
    throw codedError("E1552", `pass deployable: one of ${names.join(", ") || "(none)"}${name ? `, not ${name}` : ""}`);
  for (const m of dep.modules)
    if (!routeModules.has(m)) throw codedError("E1552", `deployable ${picked} names unknown module ${m}`);
  const served = table.filter((r) => dep.modules.includes(moduleOf(r.id)));
  if (dep.adapter === "static")
    for (const r of served) {
      const params = r.def.params !== undefined || r.segments.some((s) => s.kind === "param");
      const actions = Object.keys(r.def.actions ?? {}).length > 0;
      if (params || actions)
        throw codedError("E1553", `static deployable ${picked}: route ${r.id} has ${params ? "params" : "actions"}`);
    }
  return served;
}
