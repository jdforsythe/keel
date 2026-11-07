import type { Input } from "../types/Input.ts";
import type { Io } from "../types/Io.ts";
import type { OutRecord } from "../types/OutRecord.ts";
import { codeFiles } from "./codeFiles.ts";
import { projectFiles } from "./projectFiles.ts";
import { runCheck } from "./runCheck.ts";
import { summary } from "./summary.ts";

/**
 * `keel check [paths]`: k.check diagnostics over the code files and `.keel/*.json` artifacts under `paths` (a
 * tampered artifact is E1005, rfc:0037), then a summary that counts every code (`--code` filters display only).
 */
export function checkCommand(input: Input, io: Io): OutRecord[] {
  const files = codeFiles(io, input.paths, true);
  const diags = runCheck(io.cwd, files, projectFiles(io));
  const errors = diags.filter((d) => d.code.startsWith("E")).length;
  const warnings = diags.filter((d) => d.code.startsWith("W")).length;
  return [...diags, summary("check", diags, { files: files.length, errors, warnings })];
}
