import type { Input } from "../types/Input.ts";
import type { Io } from "../types/Io.ts";
import type { Diag } from "./Diag.ts";
import { isRecord } from "./isRecord.ts";
import { makeDiag } from "./makeDiag.ts";
import { projectFiles } from "./projectFiles.ts";
import { relPath } from "./relPath.ts";

/**
 * The base surface of `keel check --base <file>` (k.compat Base): the parsed file, from the project's files or else
 * `io.read` (the generated CI writes it outside the tree), resolved against `cwd`; `undefined` without the flag. A
 * missing or non-JSON file, or one that is not a `surface.json` (`{ data: { routes, services } }`), is E1052 naming `--base`.
 */
export function baseInput(
  input: Input,
  io: Io,
): { readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly diag: Diag } {
  if (input.base === undefined) return { ok: true, value: undefined };
  const name = JSON.stringify(input.base.slice(0, 60));
  const fail = (why: string) => ({
    ok: false as const,
    diag: makeDiag("E1052", `--base file ${why}: ${name}`, { see: "k.compat" }),
  });
  const rel = relPath(io.cwd, input.base);
  const source = projectFiles(io).find((f) => f.path === rel)?.source ?? io.read?.(input.base);
  if (source === undefined) return fail("not found");
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    return fail("is not valid JSON");
  }
  const data = isRecord(value) ? value.data : undefined;
  if (!isRecord(data) || !isRecord(data.routes) || !Array.isArray(data.services)) return fail("is not a surface.json");
  return { ok: true, value };
}
