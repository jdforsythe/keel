import { SCRUB_CAP } from "./SCRUB_CAP.ts";
import { pastCap } from "./pastCap.ts";
import { tallyOf } from "./tallyOf.ts";
import { utf8Bytes } from "./utf8Bytes.ts";

/**
 * Adds each of `values` to `into`, one of a scope's value sets, and counts what it adds (k.privacy Cost): the UTF-8
 * bytes (`utf8Bytes`) of each string not counted yet in the scope (`tallyOf`), the value and its NFC and NFD where
 * they differ, so a value in two sets of the scope counts once. Once the count passes `cap` bytes (65,536,
 * `SCRUB_CAP`) every set of the scope is past the cap (`pastCap`) and takes no more values, so each text scrubbed with
 * it is one mark. A value costs steps linear in its length, and the cap is read as each value arrives: no matcher is
 * built to learn it. `cap` is for tests.
 */
export function holdValues(into: Set<string>, values: Iterable<string>, cap: number = SCRUB_CAP): void {
  if (pastCap.has(into)) return;
  const t = tallyOf(into);
  for (const v of values) {
    if (into.has(v)) continue;
    into.add(v);
    for (const x of [v, v.normalize("NFC"), v.normalize("NFD")]) {
      if (t.counted.has(x)) continue;
      t.counted.add(x);
      t.bytes += utf8Bytes(x);
    }
    if (t.bytes > cap) {
      for (const s of t.sets) pastCap.add(s);
      return;
    }
  }
}
