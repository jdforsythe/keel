import type { Input } from "../types/Input.ts";
import type { Io } from "../types/Io.ts";
import type { OutRecord } from "../types/OutRecord.ts";
import { baseInput } from "./baseInput.ts";
import { codeFiles } from "./codeFiles.ts";
import { deployFreshness } from "./deployFreshness.ts";
import { projectFiles } from "./projectFiles.ts";
import { runCheck } from "./runCheck.ts";
import { summary } from "./summary.ts";

/**
 * `keel check [paths]`: k.check diagnostics over the code files and `.keel/*.json` artifacts under `paths` (a
 * tampered, forged, or stale artifact is E1005, rfc:0037, rfc:0050; stdlib `deps` imported first, E1159, rfc:0066), then a summary that counts every code (`--code` filters display only).
 * `--base <surface.json>` hands the deployed surface to the k.compat pass (E1562); an unusable file is E1052.
 */
export async function checkCommand(input: Input, io: Io): Promise<OutRecord[]> {
  const files = codeFiles(io, input.paths, true);
  const base = baseInput(input, io);
  if (!base.ok) return [base.diag, summary("check", [base.diag], { files: files.length, errors: 1, warnings: 0 })];
  const checked = await runCheck(io.cwd, files, projectFiles(io), base.value);
  const diags = [...checked, ...deployFreshness(projectFiles(io))];
  const errors = diags.filter((d) => d.code.startsWith("E")).length;
  const warnings = diags.filter((d) => d.code.startsWith("W")).length;
  return [...diags, summary("check", diags, { files: files.length, errors, warnings })];
}
