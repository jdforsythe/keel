const RE = /^([^:#]*):([^#]*)#(.*)$/;

/** Splits `<subject>:<target>#<path>`; undefined when malformed or the target/path is empty. */
export function parseRedactEntry(entry: string): { subject: string; target: string; path: string } | undefined {
  const m = RE.exec(entry);
  if (m === null || !m[2] || !m[3]) return undefined;
  return { subject: m[1] ?? "", target: m[2], path: m[3] };
}
