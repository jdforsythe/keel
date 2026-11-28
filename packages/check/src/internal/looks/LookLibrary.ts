import type { Shipped } from "./Shipped.ts";

/**
 * A library in a project, as k.looks reads it: its package `name`, module `id`, the real folder holding its files
 * (`<p>node_modules/<name>/`, or the project's own folder for the library itself), whether it is that own library,
 * its `./tokens` entry (`none`, `ok` at `./src/<id>Tokens.ts`, or `wrong` with the offset of `"exports"` in its
 * `package.json`), and the shipped file's real path and reading when the entry is `ok` and the file is there.
 */
export type LookLibrary = {
  readonly name: string;
  readonly id: string;
  readonly folder: string;
  readonly own: boolean;
  readonly packagePath: string;
  readonly entry: "none" | "ok" | "wrong";
  readonly exportsAt: number;
  readonly shippedPath: string;
  readonly shipped: Shipped | null;
};
