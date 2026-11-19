import type { SourceFile } from "../types/SourceFile.ts";
import { topologyFor } from "./topologyFor.ts";

const SERVER_NAME = /\.(?:server|guard)\.[cm]?[jt]sx?$/;

/**
 * A file the browser can load (k.host Node globals): with a `topology.ts` in its project, under `modules/<id>/` of a
 * module a deployable lists and not server-only (k.boundary: a `*.server.*` or `*.guard.*` file is, unless only
 * `client` deployables list its module), except the `routes.ts` of a module no `client` or `static` deployable lists.
 * With no `topology.ts`, every file not named `*.server.*` or `*.guard.*`.
 */
export function isBrowserFile(path: string, project: readonly SourceFile[]): boolean {
  const read = topologyFor(path, project);
  if (read === undefined) return !SERVER_NAME.test(path);
  const m = /^modules\/([^/]+)\/(.+)$/.exec(path.slice(read.dir.length));
  if (m === null) return false;
  const [, id = "", rest = ""] = m;
  const listing = Object.values(read.topology ?? {}).filter((d) => d.modules.includes(id));
  if (listing.length === 0) return false;
  if (SERVER_NAME.test(rest)) return listing.every((d) => d.adapter === "client");
  return rest !== "routes.ts" || listing.some((d) => d.adapter !== "node");
}
