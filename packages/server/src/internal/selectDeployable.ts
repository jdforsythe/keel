import type { Topology } from "@keel/compiler";
import { type Located, routeActions } from "@keel/router/internal";
import { codedError } from "./codedError.ts";
import { moduleOf } from "./moduleOf.ts";

/**
 * Pick the deployable to serve and validate it. E1552: one module is in two deployables (whole topology), or
 * the served deployable names a module no route or runner belongs to (other deployables' modules are ignored; they
 * may be loaded by another process). E1553: a `static` deployable contains a route with params or actions.
 * E1558: a non-`node` deployable serves a route with a live loader. E1511: a non-`node` deployable serves an API route
 * (k.api). Returns the routes of the served deployable's modules.
 */
export function selectDeployable(
  topology: Topology,
  table: readonly Located[],
  known: ReadonlySet<string>,
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
    if (!known.has(m)) throw codedError("E1552", `deployable ${picked} names unknown module ${m}`);
  const served = table.filter((r) => dep.modules.includes(moduleOf(r.id)));
  const api = served.find((r) => r.def.api);
  if (api !== undefined && dep.adapter !== "node")
    throw codedError("E1511", `${dep.adapter} deployable ${picked}: API route ${api.id} needs a node deployable`);
  const live = served.find((r) => r.def.loader?.live !== undefined);
  if (live !== undefined && dep.adapter !== "node")
    throw codedError(
      "E1558",
      `${dep.adapter} deployable ${picked}: route ${live.id} has a live loader; serve it from a node deployable`,
    );
  if (dep.adapter === "static")
    for (const r of served) {
      const params = r.def.params !== undefined || r.segments.some((s) => s.kind === "param");
      const actions = routeActions.has(r.def);
      if (params || actions)
        throw codedError("E1553", `static deployable ${picked}: route ${r.id} has ${params ? "params" : "actions"}`);
    }
  return served;
}
