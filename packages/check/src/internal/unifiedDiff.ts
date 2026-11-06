const CONTEXT = 3;
const NO_EOL = "\\ No newline at end of file";

type Lines = { lines: string[]; eol: boolean };
type Op = { kind: " " | "-" | "+"; text: string; a: number; b: number };

function split(text: string): Lines {
  if (text === "") return { lines: [], eol: true };
  const eol = text.endsWith("\n");
  return { lines: (eol ? text.slice(0, -1) : text).split("\n"), eol };
}

/** Line edit script (LCS over the region between the common prefix and suffix). */
function script(a: Lines, b: Lines): Op[] {
  // A last line whose newline status differs is a change, so it never joins the common suffix.
  const x = a.eol ? a.lines : [...a.lines.slice(0, -1), `${a.lines[a.lines.length - 1] ?? ""}\u0000`];
  const y = b.eol ? b.lines : [...b.lines.slice(0, -1), `${b.lines[b.lines.length - 1] ?? ""}\u0000`];
  let pre = 0;
  while (pre < x.length && pre < y.length && x[pre] === y[pre]) pre++;
  let suf = 0;
  while (suf < x.length - pre && suf < y.length - pre && x[x.length - 1 - suf] === y[y.length - 1 - suf]) suf++;
  const n = x.length - pre - suf;
  const m = y.length - pre - suf;
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    const row = lcs[i] ?? [];
    const next = lcs[i + 1] ?? [];
    for (let j = m - 1; j >= 0; j--)
      row[j] = x[pre + i] === y[pre + j] ? (next[j + 1] ?? 0) + 1 : Math.max(next[j] ?? 0, row[j + 1] ?? 0);
  }
  const ops: Op[] = [];
  for (let i = 0; i < pre; i++) ops.push({ kind: " ", text: a.lines[i] ?? "", a: i, b: i });
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && x[pre + i] === y[pre + j]) {
      ops.push({ kind: " ", text: a.lines[pre + i] ?? "", a: pre + i, b: pre + j });
      i++;
      j++;
    } else if (i < n && (j >= m || (lcs[i + 1]?.[j] ?? 0) >= (lcs[i]?.[j + 1] ?? 0))) {
      ops.push({ kind: "-", text: a.lines[pre + i] ?? "", a: pre + i, b: pre + j });
      i++;
    } else {
      ops.push({ kind: "+", text: b.lines[pre + j] ?? "", a: pre + i, b: pre + j });
      j++;
    }
  }
  for (let k = 0; k < suf; k++)
    ops.push({ kind: " ", text: a.lines[x.length - suf + k] ?? "", a: x.length - suf + k, b: y.length - suf + k });
  return ops;
}

const range = (start: number, len: number): string =>
  len === 1 ? `${start}` : `${len === 0 ? start - 1 : start},${len}`;

/**
 * A git-applicable unified diff of one file: `--- a/<path>`, `+++ b/<path>`, then hunks with up to 3 lines
 * of context (hunks closer than 6 lines merge), and `\ No newline at end of file` markers. Empty string
 * when the texts are equal. No trailing newline.
 */
export function unifiedDiff(path: string, before: string, after: string): string {
  if (before === after) return "";
  const a = split(before);
  const b = split(after);
  const ops = script(a, b);
  const changed = ops.flatMap((o, k) => (o.kind === " " ? [] : [k]));
  const out = [`--- a/${path}`, `+++ b/${path}`];
  let k = 0;
  while (k < changed.length) {
    const first = changed[k] ?? 0;
    let last = first;
    while (k + 1 < changed.length && (changed[k + 1] ?? 0) - last <= 2 * CONTEXT) last = changed[++k] ?? last;
    k++;
    const from = Math.max(0, first - CONTEXT);
    const to = Math.min(ops.length, last + CONTEXT + 1);
    const hunk = ops.slice(from, to);
    const aLen = hunk.filter((o) => o.kind !== "+").length;
    const bLen = hunk.filter((o) => o.kind !== "-").length;
    const aStart = (hunk.find((o) => o.kind !== "+")?.a ?? hunk[0]?.a ?? 0) + 1;
    const bStart = (hunk.find((o) => o.kind !== "-")?.b ?? hunk[0]?.b ?? 0) + 1;
    out.push(`@@ -${range(aStart, aLen)} +${range(bStart, bLen)} @@`);
    for (const o of hunk) {
      out.push(`${o.kind}${o.text}`);
      const lastA = o.kind !== "+" && !a.eol && o.a === a.lines.length - 1;
      const lastB = o.kind !== "-" && !b.eol && o.b === b.lines.length - 1;
      if (lastA || lastB) out.push(NO_EOL);
    }
  }
  return out.join("\n");
}
