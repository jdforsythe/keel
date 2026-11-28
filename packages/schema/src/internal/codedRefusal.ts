import type { Held } from "./Held.ts";

/**
 * A coded refusal (k.deploy Refusals at start): an `Error` whose message is `<code> <message>`, with own `code` and,
 * when given, `see`, entered in `record`. Its message is Keel's own text with names the app declared, never a value.
 */
export function codedRefusal(
  record: Held,
  code: `E${number}`,
  message: string,
  see?: string,
): Error & { readonly code: string } {
  const e = Object.assign(new Error(`${code} ${message}`), see === undefined ? { code } : { code, see });
  record.add(e);
  return e;
}
