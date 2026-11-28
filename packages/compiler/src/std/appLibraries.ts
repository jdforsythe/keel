import fs from "node:fs";
import path from "node:path";
import { listSources } from "../internal/listSources.ts";
import type { Library } from "../types/Library.ts";
import { libraryFiles } from "./libraryFiles.ts";

const MANIFEST = /(?:^|\/)modules\/[^/]+\/module\.[cm]?[jt]s$/;

/**
 * The libraries of the project at `root` whose files the app compiles as its own (k.library In an app): those its
 * module manifests reach (`libraryFiles`), of kind `library`.
 */
export function appLibraries(root: string): Library[] {
  const manifests = listSources(root)
    .filter((rel) => MANIFEST.test(rel))
    .map((rel) => ({ path: rel, source: fs.readFileSync(path.join(root, rel), "utf8") }));
  return libraryFiles(root, manifests).filter((l) => l.kind === "library");
}
