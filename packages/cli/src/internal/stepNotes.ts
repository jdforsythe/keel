import type { Diag } from "./Diag.ts";
import { noteDiag } from "./noteDiag.ts";

/**
 * Sort the lines of one `keel build` disk step into diagnostics and stderr text. A Keel-coded line is a diagnostic;
 * a line without a code is stderr text. An `advisory` step (the `routes.json` evaluation and the Vite builds, whose
 * Keel-coded lines are the plugin's warnings) keeps every line as stderr text, so it never fails the build.
 */
export function stepNotes(notes: readonly string[], advisory: boolean): { diagnostics: Diag[]; stderr: string } {
  const diagnostics: Diag[] = [];
  let stderr = "";
  for (const note of notes) {
    const d = noteDiag(note);
    if (d === undefined || advisory) stderr += note;
    else diagnostics.push(d);
  }
  return { diagnostics, stderr };
}
