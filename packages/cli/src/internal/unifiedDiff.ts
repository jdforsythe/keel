const CONTEXT = 3;
const MAX_CELLS = 4_000_000;

type Op = { readonly t: " " | "-" | "+"; readonly line: string };

const linesOf = (text: string | null): string[] => {
  if (text === null || text === "") return [];
  const ls = text.split("\n");
  if (ls.at(-1) === "") ls.pop();
  return ls;
};

/** Line edit script by longest common subsequence; whole replacement when the table would be too large. */
function script(a: readonly string[], b: readonly string[]): Op[] {
  if (a.length * b.length > MAX_CELLS)
    return [...a.map((line): Op => ({ t: "-", line })), ...b.map((line): Op => ({ t: "+", line }))];
  const w = b.length + 1;
  const lcs = new Uint32Array((a.length + 1) * w);
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      lcs[i * w + j] =
        a[i] === b[j]
          ? (lcs[(i + 1) * w + j + 1] ?? 0) + 1
          : Math.max(lcs[(i + 1) * w + j] ?? 0, lcs[i * w + j + 1] ?? 0);
  const out: Op[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    const ai = a[i];
    const bj = b[j];
    if (ai !== undefined && bj !== undefined && ai === bj) {
      out.push({ t: " ", line: ai });
      i++;
      j++;
    } else if (ai !== undefined && (bj === undefined || (lcs[(i + 1) * w + j] ?? 0) >= (lcs[i * w + j + 1] ?? 0))) {
      out.push({ t: "-", line: ai });
      i++;
    } else {
      out.push({ t: "+", line: bj ?? "" });
      j++;
    }
  }
  return out;
}

/**
 * A git-style unified diff of one file (`null` = absent: created or removed), hunks with 3 lines of context.
 * Empty string when nothing changed.
 */
export function unifiedDiff(path: string, before: string | null, after: string | null): string {
  const ops = script(linesOf(before), linesOf(after));
  const changed = ops.flatMap((o, k) => (o.t === " " ? [] : [k]));
  if (changed.length === 0) return "";
  const head = [
    before === null ? "--- /dev/null" : `--- a/${path}`,
    after === null ? "+++ /dev/null" : `+++ b/${path}`,
  ];
  const groups: [number, number][] = [];
  for (const k of changed) {
    const last = groups.at(-1);
    if (last !== undefined && k - last[1] <= 2 * CONTEXT) last[1] = k;
    else groups.push([k, k]);
  }
  const hunks = groups.map(([from, to]) => {
    const start = Math.max(0, from - CONTEXT);
    const end = Math.min(ops.length - 1, to + CONTEXT);
    let oldLine = 1;
    let newLine = 1;
    for (const o of ops.slice(0, start)) {
      if (o.t !== "+") oldLine++;
      if (o.t !== "-") newLine++;
    }
    const body = ops.slice(start, end + 1);
    const oldCount = body.filter((o) => o.t !== "+").length;
    const newCount = body.filter((o) => o.t !== "-").length;
    const range = (line: number, count: number): string => `${count === 0 ? line - 1 : line},${count}`;
    return [
      `@@ -${range(oldLine, oldCount)} +${range(newLine, newCount)} @@`,
      ...body.map((o) => `${o.t}${o.line}`),
    ].join("\n");
  });
  return [...head, ...hunks].join("\n");
}
