import type { Input } from "../types/Input.ts";
import type { Io } from "../types/Io.ts";
import type { Diag } from "./Diag.ts";
import { isRecord } from "./isRecord.ts";
import { makeDiag } from "./makeDiag.ts";
import { projectFiles } from "./projectFiles.ts";
import { relPath } from "./relPath.ts";

/** The surface `version` this keel writes and compares (k.compat Surface). */
const VERSION = 1;

/**
 * The base surface of `keel check --base <file>` (k.compat Base): the parsed file, from the project's files or else
 * `io.read` (the generated CI writes it outside the tree), resolved against `cwd`; `undefined` without the flag. A file
 * that is absent, not JSON, not a `surface.json` (`{ data: { routes, services } }`) or of another `version` is no base:
 * one W1568 at the file, and no E1562 is checked.
 */
export function baseInput(input: Input, io: Io): { readonly value: unknown; readonly warn?: Diag } {
  if (input.base === undefined) return { value: undefined };
  const rel = relPath(io.cwd, input.base);
  const none = {
    value: undefined,
    warn: makeDiag("W1568", `no base surface of version ${VERSION}; E1562 not checked`, {
      path: rel,
      line: 1,
      col: 1,
      see: "k.compat",
    }),
  };
  const source = projectFiles(io).find((f) => f.path === rel)?.source ?? io.read?.(input.base);
  if (source === undefined) return none;
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    return none;
  }
  const data = isRecord(value) ? value.data : undefined;
  if (!isRecord(data) || !isRecord(data.routes) || !Array.isArray(data.services) || data.version !== VERSION)
    return none;
  return { value };
}
