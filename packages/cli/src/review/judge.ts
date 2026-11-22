import type { Found } from "./Found.ts";
import type { Judged } from "./Judged.ts";

/**
 * Novelty in a range (k.review Novelty): within each code and path, a head finding whose `id` the base holds is
 * `standing`; each other one takes the unmatched base finding nearest its line as `changed`, each base finding once;
 * the rest are `new`. `accepted(found, base)` turns a standing finding `accepted`.
 */
export function judge(
  head: readonly Found[],
  base: readonly Found[],
  accepted: (found: Found, base: Found) => boolean,
): Judged[] {
  const groups = new Map<string, Found[]>();
  for (const b of base) groups.set(`${b.code}\n${b.path}`, [...(groups.get(`${b.code}\n${b.path}`) ?? []), b]);
  const used = new Set<Found>();
  const out = new Map<Found, Judged>();
  for (const f of head) {
    const same = (groups.get(`${f.code}\n${f.path}`) ?? []).find((b) => b.id === f.id && !used.has(b));
    if (same === undefined) continue;
    used.add(same);
    out.set(f, { found: f, novelty: accepted(f, same) ? "accepted" : "standing", base: same });
  }
  for (const f of head) {
    if (out.has(f)) continue;
    const left = (groups.get(`${f.code}\n${f.path}`) ?? []).filter((b) => !used.has(b));
    const near = left.sort((a, b) => Math.abs(a.line - f.line) - Math.abs(b.line - f.line) || a.line - b.line)[0];
    if (near === undefined) out.set(f, { found: f, novelty: "new" });
    else {
      used.add(near);
      out.set(f, { found: f, novelty: "changed", base: near });
    }
  }
  return head.map((f) => out.get(f) ?? { found: f, novelty: "new" });
}
