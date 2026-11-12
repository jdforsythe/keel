import type { OutRecord } from "@keel/cli";
import { SessionGroup } from "./SessionGroup.schema.ts";

const diag = (code: "E2007" | "E2008", message: string, file: string): OutRecord => ({
  kind: "diag",
  code,
  path: file,
  line: 1,
  col: 1,
  message: message.length > 89 ? `${message.slice(0, 86)}...` : message,
  see: "std.multi",
});

/**
 * The std.multi rules for a group file's text at `file`, each at 1:1: E2007 when it is not JSON or fails
 * `SessionGroup` (at its first issue), else E2008 for each user session without a `seed` (its replay could not draw
 * the ids it recorded). A clean group gives none.
 */
export function groupDiags(text: string, file: string): OutRecord[] {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return [diag("E2007", "group file fails sessions.SessionGroup at (root): not JSON", file)];
  }
  const r = SessionGroup.parse(raw);
  if (!r.ok) {
    const issue = r.error.data.issues[0];
    const at = issue === undefined || issue.path.length === 0 ? "(root)" : issue.path.join(".");
    return [
      diag("E2007", `group file fails sessions.SessionGroup at ${at}: ${String(issue?.rule ?? "invalid")}`, file),
    ];
  }
  return r.value.users.flatMap((u, i) =>
    u.seed === undefined ? [diag("E2008", `group user ${i}'s session has no seed`, file)] : [],
  );
}
