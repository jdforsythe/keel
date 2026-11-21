import type { SourceFile } from "../../types/SourceFile.ts";
import { contractCalls } from "../contractCalls.ts";
import { parseFile } from "../parseFile.ts";
import { schemaSourceOf } from "../schemaSourceOf.ts";
import type { At } from "./At.ts";
import { memberOf } from "./memberOf.ts";

/**
 * Where API entry `id` of `file`'s contract is written, read statically: the entry's object (`part` `null`), or the
 * schema expression of its `params`, `query`, `body` or `output`, or of `errors[<status>]` (`part` `errors.<status>`),
 * through consts and relative imports. `null` when the source does not spell it out.
 */
export function entrySchemaAt(
  file: SourceFile,
  id: string,
  part: string | null,
  project: readonly SourceFile[],
): At | null {
  const parsed = parseFile(file);
  const [call] = contractCalls(file, parsed.program);
  if (call === undefined || call.entries === null) return null;
  const entries: At = { expr: call.entries, file, src: schemaSourceOf(file.path, parsed.program) };
  const entry = memberOf(entries, id, project)?.value ?? null;
  if (part === null) return entry;
  const [head, status] = part.split(".");
  const value = memberOf(entry, head ?? part, project)?.value ?? null;
  return status === undefined ? value : (memberOf(value, status, project)?.value ?? null);
}
