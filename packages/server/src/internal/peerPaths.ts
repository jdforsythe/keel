import type { Topology } from "@keel/compiler";
import type { PeerPath } from "./PeerPath.ts";
import { attempted } from "./attempted.ts";

/**
 * The paths `peers` serve (k.topology Calls and peers): each route of `<artifacts>/routes.json` (`{ data }`, data by
 * route id with `module` and `path`) whose module is in a deployable named in `peers`, marked `local` when the entry
 * has `local: true`. No artifacts, no file or an unreadable one: none.
 */
export async function peerPaths(
  artifacts: string | undefined,
  topology: Topology,
  peers: readonly string[],
): Promise<readonly PeerPath[]> {
  if (artifacts === undefined || peers.length === 0) return [];
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const text = await fs.readFile(path.join(artifacts, "routes.json"), "utf8").catch(() => "");
  const parsed = attempted((): unknown => JSON.parse(text));
  const doc: unknown = parsed.ok ? parsed.value : undefined;
  const data: unknown = typeof doc === "object" && doc !== null ? Reflect.get(doc, "data") : undefined;
  if (typeof data !== "object" || data === null) return [];
  const out: PeerPath[] = [];
  for (const entry of Object.values(data)) {
    const route: unknown = entry;
    if (typeof route !== "object" || route === null) continue;
    const module: unknown = Reflect.get(route, "module");
    const p: unknown = Reflect.get(route, "path");
    const deployable = peers.find((d) => typeof module === "string" && topology[d]?.modules.includes(module));
    const local = Reflect.get(route, "local") === true ? { local: true as const } : {};
    if (deployable !== undefined && typeof p === "string")
      out.push({ segments: p.split("/").filter((x) => x !== ""), deployable, ...local });
  }
  return out;
}
