import { stdExport } from "../internal/stdExport.ts";

/**
 * The contract of placed module `id` when it is a stdlib module (k.contract): its package's `./contract` export,
 * found as `stdExport` finds it. Gives the export's real file, the package's real directory and the import specifier
 * (`@keel/std-x/contract`); undefined for an app module, an unknown id, or a package without `./contract`.
 */
export function stdContract(root: string, id: string): [file: string, pkg: string, spec: string] | undefined {
  return stdExport(root, id, "./contract");
}
