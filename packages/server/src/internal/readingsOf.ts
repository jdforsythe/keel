import type { View } from "./View.ts";
import { decodedView } from "./decodedView.ts";

const holdsPlus = (v: View): boolean => v.units.subarray(0, v.n).includes(43);

/**
 * The readings of `text` the scrub matches (k.privacy Views): the text as is; its decoded view (`decodedView`) with
 * `+` as a space and with `+` kept; and the decoded view of each of those, the first again both ways, the second with
 * `+` kept. Reading `+` as a space at either decoding and as `+` at the other gives the same text whichever decoding
 * does it, so these are all the texts two decodings give with each one's `+` read either way. A view that would be
 * the text it is made from is left out, as is a reading with `+` kept from a text with no `+` (it is the other
 * reading). So at most six readings, each made in steps linear in the text's length.
 */
export function readingsOf(text: string): View[] {
  const n = text.length;
  const units = new Uint16Array(n);
  let escapes = false;
  for (let i = 0; i < n; i++) {
    const c = text.charCodeAt(i);
    units[i] = c;
    if (c === 37 || c === 43 || c === 92 || c === 38) escapes = true;
  }
  const raw: View = { units, n, first: undefined, last: undefined };
  if (!escapes) return [raw];
  const out = [raw];
  const spaced = decodedView(raw, false);
  const kept = holdsPlus(raw) ? decodedView(raw, true) : undefined;
  if (spaced !== undefined) {
    out.push(spaced);
    const ss = decodedView(spaced, false);
    if (ss !== undefined) out.push(ss);
    const sk = holdsPlus(spaced) ? decodedView(spaced, true) : undefined;
    if (sk !== undefined) out.push(sk);
  }
  if (kept !== undefined) {
    out.push(kept);
    const kk = decodedView(kept, true);
    if (kk !== undefined) out.push(kk);
  }
  return out;
}
