import type { Result } from "@keel/schema";
import { libraryExampleTsx } from "../templates/libraryExampleTsx.ts";
import { libraryIndexTs } from "../templates/libraryIndexTs.ts";
import { libraryModuleTs } from "../templates/libraryModuleTs.ts";
import { libraryPackageJson } from "../templates/libraryPackageJson.ts";
import { libraryReadme } from "../templates/libraryReadme.ts";
import { libraryTestTs } from "../templates/libraryTestTs.ts";
import { libraryTsconfigBuildJson } from "../templates/libraryTsconfigBuildJson.ts";
import { libraryTsconfigJson } from "../templates/libraryTsconfigJson.ts";
import { libraryVitestConfigTs } from "../templates/libraryVitestConfigTs.ts";
import { tokensTs } from "../templates/tokensTs.ts";
import type { Edit } from "../types/Edit.ts";
import type { ScaffoldError } from "../types/ScaffoldError.ts";
import type { Writes } from "./Writes.ts";
import { badInput } from "./badInput.ts";
import { camelJoin } from "./camelJoin.ts";
import { commit } from "./commit.ts";
import { fail } from "./fail.ts";
import { inputs } from "./inputs.ts";

/** `@<scope>/<base>`: lowercase letters, digits and `-`; the base `-`-joined segments, the first starting with a letter, so its lowerCamel form is a module id. */
const NAME = /^@[a-z0-9][a-z0-9-]*\/([a-z][a-z0-9]*(?:-[a-z0-9]+)*)$/;

/**
 * `scaffold library <name>` (k.library-pack Scaffold): folder `<base>/` holding a library that passes `keel check` and
 * `keel test` as written: `package.json`, `module.ts` (`id` the base in lowerCamel), `src/index.ts`, `src/Example.tsx`,
 * `test/Example.test.ts`, `tokens.ts` as `project` writes it, `tsconfig.json`, `tsconfig.build.json`,
 * `vitest.config.ts` and `README.md`. `version` is the scaffolding `@keel/cli`'s, the `@keel/*` entries' range.
 * A name of another form is E1352; a tree already holding `<base>/`, or `exists` (the caller found the folder on disk), E1351.
 */
export function opLibrary(input: unknown, files: ReadonlyMap<string, string>): Result<Edit, ScaffoldError> {
  const r = inputs.library.parse(input);
  if (!r.ok) return badInput("library", r.error);
  const { name, version = "0.0.0", exists = false } = r.value;
  const base = NAME.exec(name)?.[1];
  if (base === undefined)
    return fail(
      "E1352",
      "package.json",
      `library name ${name.slice(0, 40)} is not @<scope>/<base> of a-z, 0-9 and -`,
    );
  const dir = `${base}/`;
  if (exists || [...files.keys()].some((p) => p.startsWith(dir)))
    return fail("E1351", `${dir}package.json`, `${base}/ already exists; scaffold the library elsewhere`);
  const id = camelJoin(base.split("-"));
  const writes: Writes = new Map([
    ["package.json", libraryPackageJson(name, version)],
    ["module.ts", libraryModuleTs(id)],
    ["src/index.ts", libraryIndexTs()],
    ["src/Example.tsx", libraryExampleTsx()],
    ["test/Example.test.ts", libraryTestTs()],
    ["tokens.ts", tokensTs()],
    ["tsconfig.json", libraryTsconfigJson()],
    ["tsconfig.build.json", libraryTsconfigBuildJson()],
    ["vitest.config.ts", libraryVitestConfigTs()],
    ["README.md", libraryReadme(name, id)],
  ]);
  return commit(files, new Map([...writes].map(([p, v]) => [`${dir}${p}`, v])));
}
