import { stdExport } from "../internal/stdExport.ts";

/**
 * The binding of placed module `id` when it is a stdlib module (k.routes Union): its package's `./routes` export,
 * found as `stdExport` finds it. Gives the export's real file, the package's real directory and the import specifier
 * (`@keel/std-x/routes`); undefined for an app module, an unknown id, or a package without `./routes`.
 */
export function stdRoutes(root: string, id: string): [file: string, pkg: string, spec: string] | undefined {
  return stdExport(root, id, "./routes");
}
