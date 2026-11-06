import type { Result } from "@keel/schema";
import { run } from "./internal/run.ts";
import type { Edit } from "./types/Edit.ts";
import type { Op } from "./types/Op.ts";
import type { ScaffoldError } from "./types/ScaffoldError.ts";

/**
 * Dry run (`--dry-run`): the exact edit set `scaffold` would produce for the same arguments, refusals
 * included. Writes nothing; a caller renders `created`/`changed`/`removed` against `files` as unified diffs.
 */
export function plan(
  op: Op,
  input: Readonly<Record<string, unknown>>,
  files: ReadonlyMap<string, string>,
): Result<Edit, ScaffoldError> {
  return run(op, input, files);
}
