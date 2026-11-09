import type { Session } from "../Session.schema.ts";

/**
 * The file a fetched session goes to: `.keel/sessions/<fingerprint>-<index>.json`, from the session's fingerprint when
 * it is 12 hex characters (else `000000000000`) and a counter, never the client `id` (backlog 0224). Throws on a
 * name with a path separator or `..`.
 */
export function fileOf(x: Session, index: number): string {
  const name = `${/^[0-9a-f]{12}$/.test(x.fingerprint) ? x.fingerprint : "0".repeat(12)}-${index}.json`;
  if (/[\\/]|\.\./.test(name)) throw new Error("bad file name");
  return `.keel/sessions/${name}`;
}
