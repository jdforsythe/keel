import { type Result, ok } from "@keel/schema";
import { libraryE2eTs } from "../templates/libraryE2eTs.ts";
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
import type { ScaffoldError } from "../types/ScaffoldError.ts";
import { camelJoin } from "./camelJoin.ts";
import { fail } from "./fail.ts";

/** `@<scope>/<base>`: lowercase letters, digits and `-`; the base `-`-joined segments, the first starting with a letter, so its lowerCamel form is a module id. */
const NAME = /^@[a-z0-9][a-z0-9-]*\/([a-z][a-z0-9]*(?:-[a-z0-9]+)*)$/;

/**
 * The eleven files of a library (k.library-pack Scaffold) from the templates alone, keyed from its own folder, and its
 * `base`: `package.json` (the `@keel/*` entries at `^<version>`), `module.ts` (`id` the base in lowerCamel),
 * `src/index.ts`, `src/Example.tsx`, `test/Example.test.ts`, `test/Example.e2e.ts` (k.e2e Libraries), `tokens.ts`, both tsconfigs, `vitest.config.ts` and
 * `README.md`. A name of another form is E1352.
 */
export function libraryFiles(
  name: string,
  version: string,
  packageManager: string | undefined = undefined,
): Result<{ readonly base: string; readonly files: Map<string, string> }, ScaffoldError> {
  const base = NAME.exec(name)?.[1];
  if (base === undefined)
    return fail("E1352", "package.json", `library name ${name.slice(0, 40)} is not @<scope>/<base> of a-z, 0-9 and -`);
  const id = camelJoin(base.split("-"));
  return ok({
    base,
    files: new Map([
      ["package.json", libraryPackageJson(name, version, packageManager)],
      ["module.ts", libraryModuleTs(id)],
      ["src/index.ts", libraryIndexTs()],
      ["src/Example.tsx", libraryExampleTsx()],
      ["test/Example.test.ts", libraryTestTs()],
      ["test/Example.e2e.ts", libraryE2eTs()],
      ["tokens.ts", tokensTs()],
      ["tsconfig.json", libraryTsconfigJson()],
      ["tsconfig.build.json", libraryTsconfigBuildJson()],
      ["vitest.config.ts", libraryVitestConfigTs()],
      ["README.md", libraryReadme(name, id)],
    ]),
  });
}
