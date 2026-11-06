import type { Topology } from "../types/Topology.ts";

/**
 * True when E1004 does not apply to `path` (k.compiler Rules; tasks/0010-compiler D40). E1004 is per
 * deployable: a file under `modules/<id>/` belongs to every deployable listing `<id>`; files outside
 * `modules/` (tests, configs, the server entry) are never subject once a topology is known. Exempt: all owners
 * are `client` (the build declares no server), or the file is `routes.ts` of a module no `static` deployable
 * lists (a node server loads the manifest; a client build bundles loaders by design). Without a topology
 * every file is subject.
 */
export function clientOnly(path: string, topology: Topology | undefined): boolean {
  const segs = path.replace(/\\/g, "/").split("/");
  const at = segs.indexOf("modules");
  const mod = at >= 0 && at < segs.length - 2 ? segs[at + 1] : undefined;
  if (topology === undefined) return false;
  if (mod === undefined) return true;
  const owners = Object.values(topology).filter((d) => d.modules.includes(mod));
  if (owners.length === 0) return false;
  if (owners.every((d) => d.adapter === "client")) return true;
  return segs.length === at + 3 && segs[at + 2] === "routes.ts" && owners.every((d) => d.adapter !== "static");
}
