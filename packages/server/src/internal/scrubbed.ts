/**
 * `message` with each of `values` replaced by `[pii]` (k.privacy Server log), longest first so a value inside another
 * is not left half-replaced.
 */
export function scrubbed(message: string, values: ReadonlySet<string>): string {
  let out = message;
  for (const v of [...values].sort((a, b) => b.length - a.length)) out = out.replaceAll(v, "[pii]");
  return out;
}
