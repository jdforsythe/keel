import type { Result } from "@keel/schema";
import type { Edit } from "../types/Edit.ts";
import type { ScaffoldError } from "../types/ScaffoldError.ts";
import { badInput } from "./badInput.ts";
import { commit } from "./commit.ts";
import { fail } from "./fail.ts";
import { inputs } from "./inputs.ts";
import { libraryFiles } from "./libraryFiles.ts";

/**
 * `scaffold library <name>` (k.library-pack Scaffold): folder `<base>/` holding the files of `libraryFiles`, which
 * pass `keel check` and `keel test` as written. `version` is the scaffolding `@keel/cli`'s, the `@keel/*` entries'
 * range. A name of another form is E1352; a tree already holding `<base>/`, or `exists` (the caller found the folder
 * on disk), E1351.
 */
export function opLibrary(input: unknown, files: ReadonlyMap<string, string>): Result<Edit, ScaffoldError> {
  const r = inputs.library.parse(input);
  if (!r.ok) return badInput("library", r.error);
  const { name, version = "0.0.0", exists = false } = r.value;
  const made = libraryFiles(name, version);
  if (!made.ok) return made;
  const dir = `${made.value.base}/`;
  if (exists || [...files.keys()].some((p) => p.startsWith(dir)))
    return fail("E1351", `${dir}package.json`, `${made.value.base}/ already exists; scaffold the library elsewhere`);
  return commit(files, new Map([...made.value.files].map(([p, v]) => [`${dir}${p}`, v])));
}
