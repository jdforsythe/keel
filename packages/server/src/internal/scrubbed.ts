import type { Probe } from "./Probe.ts";
import { matcherOf } from "./matcherOf.ts";

interface Hit {
  readonly at: number;
  readonly end: number;
  readonly pass: number;
}

/** Every place `probe` matches in `text`, one per start (the longest there), so overlapping matches are all found. */
const hits = (text: string, probe: Probe, pass: number, into: Hit[]): void => {
  for (let from = 0; from < text.length; ) {
    probe.head.lastIndex = from;
    const m = probe.head.exec(text);
    if (m === null) return;
    let end = m.index + m[0].length;
    for (const t of probe.tail) {
      t.lastIndex = end;
      const n = t.exec(text);
      end = n === null ? -1 : end + n[0].length;
      if (n === null) break;
    }
    if (end > m.index) into.push({ at: m.index, end, pass });
    const step = probe.head.unicode && (text.codePointAt(m.index) ?? 0) > 0xffff ? 2 : 1;
    from = Math.max(from + 1, m.index + step);
  }
};

/**
 * `message` with each value of each pass replaced by that pass's mark (k.privacy Server log), in each written form
 * `matcherOf` matches. Every match of every pass is found, overlapping ones too, and each run of overlapping matches is
 * replaced as a whole, so no part of a value is left. The run's mark is that of its longest match; of two as long, the
 * earlier pass's.
 */
export function scrubbed(message: string, passes: readonly (readonly [ReadonlySet<string>, string])[]): string {
  const found: Hit[] = [];
  passes.forEach(([values], pass) => {
    if (values.size > 0) for (const p of matcherOf(values)) hits(message, p, pass, found);
  });
  if (found.length === 0) return message;
  found.sort((a, b) => a.at - b.at || a.pass - b.pass);
  const out: string[] = [];
  let last = 0;
  let run: { at: number; end: number; best: Hit } | undefined;
  const close = (r: { at: number; end: number; best: Hit }): void => {
    out.push(message.slice(last, r.at), passes[r.best.pass]?.[1] ?? "");
    last = r.end;
  };
  for (const h of found) {
    if (run !== undefined && h.at < run.end) {
      run.end = Math.max(run.end, h.end);
      const longer = h.end - h.at - (run.best.end - run.best.at);
      if (longer > 0 || (longer === 0 && h.pass < run.best.pass)) run.best = h;
    } else {
      if (run !== undefined) close(run);
      run = { at: h.at, end: h.end, best: h };
    }
  }
  if (run !== undefined) close(run);
  out.push(message.slice(last));
  return out.join("");
}
