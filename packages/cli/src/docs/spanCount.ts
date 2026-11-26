/** Letters, digits, `_` and `$`: a character that continues a name. */
const NAME_CHAR = /[\p{L}\p{N}_$]/u;

/** The code spans of a markdown text: a run of backticks opens one, the next run of the same length on its line closes it. */
function spans(text: string): string[] {
  const out: string[] = [];
  for (const line of text.split("\n")) {
    let open: { len: number; at: number } | undefined;
    for (const m of line.matchAll(/`+/g)) {
      const run = m[0];
      if (open === undefined) open = { len: run.length, at: m.index + run.length };
      else if (run.length === open.len) {
        out.push(line.slice(open.at, m.index));
        open = undefined;
      }
    }
  }
  return out;
}

/** Whether `span` holds `name` ignoring case, with no name character right before or after it. */
function holds(span: string, name: string): boolean {
  const s = span.toLowerCase();
  const n = name.toLowerCase();
  for (let at = s.indexOf(n); at !== -1; at = s.indexOf(n, at + 1)) {
    const before = at === 0 ? "" : (s[at - 1] ?? "");
    const after = s[at + n.length] ?? "";
    if (!NAME_CHAR.test(before) && !NAME_CHAR.test(after)) return true;
  }
  return false;
}

/** How many code spans of `text` hold `name` (k.docs Forms, `docs.hit`). */
export function spanCount(text: string, name: string): number {
  return name === "" ? 0 : spans(text).filter((s) => holds(s, name)).length;
}
