import type { LookLibrary } from "./LookLibrary.ts";

/**
 * What a rule reads of k.looks in its project (`projectLooks`): the library holding a file at its view path, and for
 * a look name a library ships, its shipped file's view path and the offset of the look's key there.
 */
export type LooksView = {
  readonly libraryOf: (viewPath: string) => LookLibrary | undefined;
  /** Whether a library the project lists ships `name` in any group: E1810 judges it, not E1801. */
  readonly ships: (name: string) => boolean;
  readonly shippedLook: (look: string) => { readonly path: string; readonly at: number } | undefined;
};
