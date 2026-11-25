import fs from "node:fs";
import path from "node:path";
import { listSources } from "../internal/listSources.ts";
import type { Library } from "../types/Library.ts";
import { libraryFiles } from "./libraryFiles.ts";

const MANIFEST = /(?:^|\/)modules\/[^/]+\/module\.[cm]?[jt]s$/;

/**
 * Every library the project at `root` reaches through its module manifests (`libraryFiles`), of either kind, each at the
 * real path of its folder: installed, linked through a workspace, or held inside the project. The server build reads
 * their bundled files' `new URL(<a>, import.meta.url)` wherever they lie (k.server-deps Files a bundled package reads).
 */
export function allLibraries(root: string): Library[] {
  const manifests = listSources(root)
    .filter((rel) => MANIFEST.test(rel))
    .map((rel) => ({ path: rel, source: fs.readFileSync(path.join(root, rel), "utf8") }));
  return libraryFiles(root, manifests);
}
