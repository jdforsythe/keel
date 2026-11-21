import type { Result } from "@keel/schema";
import { run } from "./internal/run.ts";
import type { DeployShells } from "./types/DeployShells.ts";
import type { Edit } from "./types/Edit.ts";
import type { Op } from "./types/Op.ts";
import type { ScaffoldError } from "./types/ScaffoldError.ts";

/**
 * Run one k.scaffold operation over a project tree (path -> content). Returns the complete edit set (the
 * new tree plus created/changed/removed paths), or the diagnostic that refused it with nothing written:
 * E1351 duplicate, E1352 naming, E1353 would break check, E1354 required field without default, E1005
 * generated location. `shells`, the registered shell targets (k.shell Shell target), give the shell files and CI
 * jobs a regenerated deploy file holds. Pure: `files` is never mutated; equal inputs give byte-identical output.
 */
export function scaffold(
  op: Op,
  input: Readonly<Record<string, unknown>>,
  files: ReadonlyMap<string, string>,
  shells: DeployShells = {},
): Result<Edit, ScaffoldError> {
  return run(op, input, files, shells);
}
