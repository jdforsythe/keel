/** What `registerNames` knows of the app's libraries (k.library In an app): their export specifiers and files. */
export type RegisterLibraries = {
  /** Each library specifier to the view path of the source its `exports` give (`projectLibraries`). */
  readonly entries: ReadonlyMap<string, string>;
  /** Whether a view path is a library's file. */
  readonly isLibrary: (path: string) => boolean;
};
