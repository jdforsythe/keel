import { folded } from "./folded.ts";
import { matcherOf } from "./matcherOf.ts";

interface Hit {
  readonly at: number;
  readonly end: number;
  readonly pass: number;
}

/** Every place `re` matches in `text`, one per start (the longest there), so overlapping matches are all found. */
const hits = (text: string, re: RegExp, pass: number, into: Hit[]): void => {
  for (let from = 0; from < text.length; ) {
    re.lastIndex = from;
    const m = re.exec(text);
    if (m === null) return;
    into.push({ at: m.index, end: m.index + m[0].length, pass });
    const step = re.unicode && (text.codePointAt(m.index) ?? 0) > 0xffff ? 2 : 1;
    from = Math.max(from + 1, m.index + step);
  }
};

/** Every place `form` stands in `text` (both folded), overlapping ones too: KMP, one pass over `text`. */
const scan = (text: string, form: string, fail: Int32Array, pass: number, into: Hit[]): void => {
  for (let i = 0, k = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    while (k > 0 && form.charCodeAt(k) !== c) k = fail[k - 1] ?? 0;
    if (form.charCodeAt(k) === c) k++;
    if (k === form.length) {
      into.push({ at: i + 1 - k, end: i + 1, pass });
      k = fail[k - 1] ?? 0;
    }
  }
};

/**
 * `message` with each value of each pass replaced by that pass's mark (k.privacy Server log), in each written form
 * `matcherOf` matches. Every match of every pass is found, overlapping ones too, and each run of overlapping matches is
 * replaced as a whole, so the whole of each marked copy is replaced. The run's mark is that of its longest match; of
 * two as long, the earlier pass's.
 */
export function scrubbed(message: string, passes: readonly (readonly [ReadonlySet<string>, string])[]): string {
  const found: Hit[] = [];
  let low: string | undefined;
  passes.forEach(([values], pass) => {
    if (values.size === 0) return;
    const { batches, long } = matcherOf(values);
    for (const re of batches) hits(message, re, pass, found);
    if (long.length > 0) low ??= folded(message);
    for (const { form, fail } of long) if (low !== undefined) scan(low, form, fail, pass, found);
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
