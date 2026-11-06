import type { Edit } from "./Edit.ts";
import { applyEdits } from "./applyEdits.ts";

const CONTEXT = 3;
const NO_EOL = "\\ No newline at end of file";

type Group = { from: number; to: number; edits: Edit[] };

/**
 * A `git apply`-able unified diff of `edits` (absolute, non-overlapping offsets) against `source`:
 * `--- a/<path>` / `+++ b/<path>` headers, one hunk per changed line range with up to three lines of
 * context (hunks whose context would overlap are merged, as diff does), and the no-newline marker
 * when the file has no final newline.
 */
export function unifiedPatch(path: string, source: string, edits: readonly Edit[]): string {
  const eol = source.endsWith("\n");
  const lines = source.split("\n");
  if (eol) lines.pop();
  const starts: number[] = [];
  let off = 0;
  for (const l of lines) {
    starts.push(off);
    off += l.length + 1;
  }
  const lineOf = (pos: number): number => {
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >>> 1;
      if ((starts[mid] ?? 0) <= pos) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  };
  const groups: Group[] = [];
  for (const e of [...edits].sort((x, y) => x.start - y.start)) {
    const from = lineOf(e.start);
    const to = lineOf(Math.max(e.start, e.end - 1));
    const last = groups[groups.length - 1];
    if (last !== undefined && from <= last.to) {
      last.to = Math.max(last.to, to);
      last.edits.push(e);
    } else groups.push({ from, to, edits: [e] });
  }
  const n = lines.length;
  const endOf = (i: number): number => (starts[i] ?? 0) + (lines[i] ?? "").length;
  const marker = (i: number): string[] => (i === n - 1 && !eol ? [NO_EOL] : []);
  const hunks: { from: number; to: number; groups: Group[] }[] = [];
  for (const g of groups) {
    const from = Math.max(0, g.from - CONTEXT);
    const to = Math.min(n - 1, g.to + CONTEXT);
    const last = hunks[hunks.length - 1];
    if (last !== undefined && from <= last.to + 1) {
      last.to = to;
      last.groups.push(g);
    } else hunks.push({ from, to, groups: [g] });
  }
  const out = [`--- a/${path}`, `+++ b/${path}`];
  let delta = 0;
  for (const h of hunks) {
    const body: string[] = [];
    let cursor = h.from;
    let added = 0;
    for (const g of h.groups) {
      for (; cursor < g.from; cursor++) body.push(` ${lines[cursor] ?? ""}`, ...marker(cursor));
      const before = lines.slice(g.from, g.to + 1);
      const after = applyEdits(source, starts[g.from] ?? 0, endOf(g.to), g.edits).split("\n");
      body.push(...before.map((l) => `-${l}`), ...marker(g.to));
      body.push(...after.map((l) => `+${l}`), ...marker(g.to));
      added += after.length - before.length;
      cursor = g.to + 1;
    }
    for (; cursor <= h.to; cursor++) body.push(` ${lines[cursor] ?? ""}`, ...marker(cursor));
    const oldCount = h.to - h.from + 1;
    out.push(`@@ -${h.from + 1},${oldCount} +${h.from + 1 + delta},${oldCount + added} @@`, ...body);
    delta += added;
  }
  return out.join("\n");
}
