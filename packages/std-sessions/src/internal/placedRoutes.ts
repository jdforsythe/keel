import type { SourceFile } from "@keel/cli";
import { stdContract } from "@keel/compiler/std/stdContract";
import { stdRoutes } from "@keel/compiler/std/stdRoutes";
import type { PlacedRoute } from "./PlacedRoute.ts";

/**
 * The route table of each of `modules` that has one, in order, as the generated entry gathers them (k.topology Route
 * table): an app module's `modules/<id>/routes.ts` (`app`, `spec` the module id), else a stdlib module's package
 * `./routes` export (`spec` the package specifier). A module with neither is left out.
 */
export function placedRoutes(root: string, files: readonly SourceFile[], modules: readonly string[]): PlacedRoute[] {
  const have = new Set(files.map((f) => f.path));
  return modules.flatMap((m): PlacedRoute[] => {
    if (have.has(`modules/${m}/routes.ts`)) return [{ module: m, app: true, spec: m, contract: "" }];
    const std = stdRoutes(root, m);
    return std === undefined
      ? []
      : [{ module: m, app: false, spec: std[2], contract: stdContract(root, m)?.[2] ?? "" }];
  });
}
