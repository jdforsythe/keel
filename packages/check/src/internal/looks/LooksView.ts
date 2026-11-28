import type { Theme } from "@keel/ui";
import type { LookLibrary } from "./LookLibrary.ts";

/**
 * What a rule reads of k.looks in its project (`projectLooks`): the library holding a file at its view path, and for
 * a look name a library ships, its shipped file's view path and the offset of the look's key there.
 */
export type LooksView = {
  readonly libraryOf: (viewPath: string) => LookLibrary | undefined;
  /** Whether a library the project lists ships `name` in any group: E1810 judges it, not E1801. */
  readonly ships: (name: string) => boolean;
  /** In a listed library's own folder whose shipped colors hold a pair, both schemes (k.schemes Schemes); else undefined. */
  readonly ownSchemes: readonly ("light" | "dark")[] | undefined;
  /**
   * In a listed library's own folder, its shipped `themes.contrast` and `themes.print` as themes keyed `contrast` and
   * `print`, each with `when` set to its key (k.themes Library themes), so a shipped contrast or print is judged as a
   * theme of that `when` whatever the root `tokens.ts` writes; else undefined.
   */
  readonly ownThemes: Readonly<Record<string, Theme>> | undefined;
  /** The id of the listed library, not the own one, that ships `look` while `tokens.ts` does not write it. */
  readonly lookLibrary: (look: string) => string | undefined;
  /** The id of the listed library, not the own one, holding the file at `viewPath`. */
  readonly libraryFileOf: (viewPath: string) => string | undefined;
  readonly shippedLook: (look: string) => { readonly path: string; readonly at: number } | undefined;
};
