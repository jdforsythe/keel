/** The fields of a trace entry whose text names a place, a kind or a count, never a person's data. */
const SHOWN = new Set(["kind", "at", "key", "id", "store", "head", "from", "code", "state", "online", "route", "name"]);

/** `JSON.stringify`'s replacer: the root, a nested `event` and the `SHOWN` scalars stay, every other value is its type and size. */
const reduce = (k: string, v: unknown): unknown => {
  if (k === "" || (k === "event" && typeof v === "object") || (SHOWN.has(k) && typeof v !== "object")) return v;
  return `<${typeof v} ${typeof v === "string" ? v.length : (JSON.stringify(v)?.length ?? 0)}>`;
};

/** One trace entry line (JSON, as E1729 prints it) without the text of the data it holds; a line that is not JSON is its size. */
function entry(line: string | undefined): string {
  if (line === undefined) return "null";
  try {
    return JSON.stringify(JSON.parse(line), reduce);
  } catch {
    return `<text ${line.length}>`;
  }
}

/**
 * The two lines after an E1729's first line, `recorded` and `replayed`, each as `entry` shows it: what a person
 * needs to see which entry differs and where, with no value, address or typed text (k.drive-law Law check).
 */
export function traceDetail(recorded: string | undefined, replayed: string | undefined): string[] {
  return [`recorded: ${entry(recorded)}`, `replayed: ${entry(replayed)}`];
}
