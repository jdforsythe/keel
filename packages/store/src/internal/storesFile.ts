import { devLoad } from "./devLoad.ts";

/**
 * Name the app file whose top level begins to run (k.data Dev): a store created from now on is created at `file`.
 * Under `keel dev` the compiler marks each app file's start with a call of it through the dev server module; it
 * records nothing until `storesReload` has run.
 */
export function storesFile(file: string): void {
  devLoad.file = file;
}
