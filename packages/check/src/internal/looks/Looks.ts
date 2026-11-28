import type { Entry } from "../modules/Entry.ts";
import type { LookLibrary } from "./LookLibrary.ts";

/**
 * What k.looks reads of one project (`dir`, `""` the root): every library in it, the ones the app lists (each
 * `deps` entry naming one, with the real path of its `module.ts`; in a library's own folder the library itself and
 * the libraries its manifest lists), the own library when the folder is one, and the library holding a real path.
 */
export type Looks = {
  readonly dir: string;
  readonly libraries: readonly LookLibrary[];
  readonly listed: readonly LookLibrary[];
  readonly entries: ReadonlyMap<string, readonly { readonly path: string; readonly entry: Entry }[]>;
  readonly own: LookLibrary | undefined;
  readonly libraryOf: (realPath: string) => LookLibrary | undefined;
};
