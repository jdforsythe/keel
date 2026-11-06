import type { Topology } from "../types/Topology.ts";

/**
 * True when every deployable that bundles `path` declares no server (`adapter: 'client'`), so E1004 does not
 * apply (k.compiler Rules). A file under `modules/<id>/` belongs to the deployables listing `<id>`; any other
 * file (or one whose module no deployable lists) belongs to all of them.
 */
export function clientOnly(path: string, topology: Topology | undefined): boolean {
  if (topology === undefined) return false;
  const all = Object.values(topology);
  const segs = path.replace(/\\/g, "/").split("/");
  const at = segs.indexOf("modules");
  const mod = at >= 0 && at < segs.length - 2 ? segs[at + 1] : undefined;
  const owners = mod === undefined ? [] : all.filter((d) => d.modules.includes(mod));
  const scope = owners.length > 0 ? owners : all;
  return scope.length > 0 && scope.every((d) => d.adapter === "client");
}
