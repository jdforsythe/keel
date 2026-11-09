import type { OutRecord } from "@keel/cli";

/** A `keel session` diagnostic (E2002-E2004 at the session file, 1:1; E1056 and I1055 at no path), `see` set. */
export function sessionDiag(code: string, message: string, file?: string): OutRecord {
  const text = message.length > 89 ? `${message.slice(0, 86)}...` : message;
  const at = file === undefined ? {} : { path: file, line: 1, col: 1 };
  return { kind: "diag", code, ...at, message: text, see: code.startsWith("E20") ? "std.sessions" : "k.cli" };
}
