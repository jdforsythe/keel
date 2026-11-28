/** A thrown value's form record (k.serverlog Thrown values), after its lead: class, code, fingerprint, site, causes. */
const FORM = /: [A-Za-z]+(?: \S+)? #[0-9a-f]{8}(?: at \S+)?(?: <- .+)?$/;

/** A log line's message: a json record's `message`, else the compact line itself. */
const messageOf = (line: string): string => {
  if (!line.startsWith("{")) return line;
  const rec: unknown = JSON.parse(line);
  const m: unknown = typeof rec === "object" && rec !== null ? Reflect.get(rec, "message") : undefined;
  return typeof m === "string" ? m : "";
};

/**
 * The lines of `lines` that are not a thrown value's form record: with full text on (`mode: 'dev'`), each throw logs its
 * form and then its text, and a test that reads the text reads these.
 */
export function textRecords(lines: readonly string[]): string[] {
  return lines.filter((l) => !FORM.test(messageOf(l)));
}
