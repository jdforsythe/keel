import type { Edit } from "@keel/check";

/** A finding's edits travel in `data` as `s0`, `e0`, `t0`, `s1`, ...; `[]` for none. */
export function packEdits(edits: readonly Edit[]): Record<string, string | number> {
  return Object.fromEntries(
    edits.flatMap((e, i) => [
      [`s${i}`, e.start],
      [`e${i}`, e.end],
      [`t${i}`, e.text],
    ]),
  );
}
