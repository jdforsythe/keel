// Independent unified-diff applier for the dry-run conformance tests. Not a test file; imports no package code.
// Format: `--- a/<p>` or `--- /dev/null`, `+++ b/<p>` or `+++ /dev/null`, `@@ -l,s +l,s @@` hunks of ' ', '-', '+' lines;
// a line is newline-terminated unless the next line is `\ No newline at end of file`.
export type PrintedEdit = { action: "create" | "change" | "remove"; path: string; diff: string };

type Line = { text: string; nl: boolean };
type Entry = { kind: " " | "-" | "+"; line: Line };
type Hunk = { oldStart: number; oldLen: number; entries: Entry[] };

function splitLines(content: string): Line[] {
  if (content === "") return [];
  const parts = content.split("\n");
  const last = parts.pop();
  const lines: Line[] = parts.map((text) => ({ text, nl: true }));
  if (last !== undefined && last !== "") lines.push({ text: last, nl: false });
  return lines;
}
function joinLines(lines: Line[]): string {
  return lines.map((l) => (l.nl ? `${l.text}\n` : l.text)).join("");
}

function parse(diff: string, path: string, action: PrintedEdit["action"]): Hunk[] {
  const lines = diff.split("\n");
  if (lines[lines.length - 1] === "") lines.pop();
  const wantOld = action === "create" ? "--- /dev/null" : `--- a/${path}`;
  const wantNew = action === "remove" ? "+++ /dev/null" : `+++ b/${path}`;
  if (lines[0] !== wantOld) throw new Error(`bad old header for ${path}: ${lines[0] ?? "(none)"}`);
  if (lines[1] !== wantNew) throw new Error(`bad new header for ${path}: ${lines[1] ?? "(none)"}`);
  const hunks: Hunk[] = [];
  let i = 2;
  while (i < lines.length) {
    const head = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(lines[i] ?? "");
    if (head === null) throw new Error(`expected hunk header at line ${i + 1} of ${path}: ${lines[i] ?? ""}`);
    const oldStart = Number(head[1]);
    const oldLen = head[2] === undefined ? 1 : Number(head[2]);
    const newLen = head[4] === undefined ? 1 : Number(head[4]);
    i += 1;
    const entries: Entry[] = [];
    let o = 0;
    let n = 0;
    while (i < lines.length && (o < oldLen || n < newLen)) {
      const l = lines[i] ?? "";
      const text = l.slice(1);
      if (l.startsWith(" ")) {
        entries.push({ kind: " ", line: { text, nl: true } });
        o += 1;
        n += 1;
      } else if (l.startsWith("-")) {
        entries.push({ kind: "-", line: { text, nl: true } });
        o += 1;
      } else if (l.startsWith("+")) {
        entries.push({ kind: "+", line: { text, nl: true } });
        n += 1;
      } else throw new Error(`bad hunk line ${i + 1} of ${path}: ${l}`);
      i += 1;
      if ((lines[i] ?? "").startsWith("\\")) {
        const prev = entries[entries.length - 1];
        if (prev !== undefined) prev.line.nl = false;
        i += 1;
      }
    }
    if (o !== oldLen || n !== newLen) throw new Error(`hunk length mismatch in ${path}`);
    hunks.push({ oldStart, oldLen, entries });
  }
  return hunks;
}

/** Apply one printed diff to the file's before content (undefined when it did not exist); undefined result = removed. */
export function applyDiff(before: string | undefined, edit: PrintedEdit): string | undefined {
  if (edit.action === "create" && before !== undefined) throw new Error(`create of existing ${edit.path}`);
  if (edit.action !== "create" && before === undefined) throw new Error(`${edit.action} of missing ${edit.path}`);
  if (edit.diff === "") {
    if (edit.action === "create") return "";
    throw new Error(`empty diff for ${edit.action} of ${edit.path}`);
  }
  const old = splitLines(before ?? "");
  const out: Line[] = [];
  let pos = 0;
  for (const h of parse(edit.diff, edit.path, edit.action)) {
    const start = h.oldLen === 0 ? h.oldStart : h.oldStart - 1;
    if (start < pos) throw new Error(`overlapping hunks in ${edit.path}`);
    while (pos < start) {
      const l = old[pos];
      if (l === undefined) throw new Error(`hunk beyond end of ${edit.path}`);
      out.push(l);
      pos += 1;
    }
    for (const e of h.entries) {
      if (e.kind !== "+") {
        const l = old[pos];
        if (l === undefined || l.text !== e.line.text || l.nl !== e.line.nl)
          throw new Error(
            `context mismatch in ${edit.path} at old line ${pos + 1}: ${JSON.stringify(l)} vs ${JSON.stringify(e.line)}`,
          );
        pos += 1;
      }
      if (e.kind !== "-") out.push(e.line);
    }
  }
  while (pos < old.length) {
    const l = old[pos];
    if (l !== undefined) out.push(l);
    pos += 1;
  }
  if (edit.action === "remove") {
    if (out.length > 0) throw new Error(`remove of ${edit.path} leaves content behind`);
    return undefined;
  }
  return joinLines(out);
}

export function applyEdits(tree: ReadonlyMap<string, string>, edits: readonly PrintedEdit[]): Map<string, string> {
  const out = new Map(tree);
  for (const e of edits) {
    const next = applyDiff(tree.get(e.path), e);
    if (next === undefined) out.delete(e.path);
    else out.set(e.path, next);
  }
  return out;
}
