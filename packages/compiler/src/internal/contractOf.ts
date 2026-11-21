import fs from "node:fs";
import path from "node:path";
import { exportOf } from "./exportOf.ts";

const ROUTES = /^modules\/([^/]+)\/routes\.ts$/;

/**
 * The contract file beside binding `routes` (k.contract): for an app module's `modules/<id>/routes.ts` (root-relative)
 * its `modules/<id>/<id>.contract.ts` when it exists under `root`; for a stdlib package's routes file (absolute) the
 * package's `./contract` export, the package being the nearest folder above it with a `package.json`. Undefined
 * when there is none.
 */
export function contractOf(root: string, routes: string): string | undefined {
  if (!path.isAbsolute(routes)) {
    const id = ROUTES.exec(routes)?.[1];
    const file = id === undefined ? undefined : `modules/${id}/${id}.contract.ts`;
    return file !== undefined && fs.existsSync(path.join(root, file)) ? file : undefined;
  }
  for (let d = path.dirname(routes); path.dirname(d) !== d; d = path.dirname(d))
    if (fs.existsSync(path.join(d, "package.json"))) return exportOf(d, "./contract")?.[0];
  return undefined;
}
