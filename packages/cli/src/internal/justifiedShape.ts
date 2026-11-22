import { JUSTIFIED_REASONS } from "./JUSTIFIED_REASONS.ts";
import type { JustifiedEntry } from "./JustifiedEntry.ts";
import { isRecord } from "./isRecord.ts";
import { justifiedKey } from "./justifiedKey.ts";

const oneSentence = (s: string): boolean => /^\S[^\n]*[.!?]$/.test(s) && !/[.!?]\s+[A-Z]/.test(s.slice(0, -1));

/**
 * The shape of a parsed `mutation-justified.json` (k.ledger Justified survivors): its entries when every one holds, else
 * one problem per bad entry (`index` from 0, with the entry's `original` when it has one): a field that is missing or
 * not text, a field the shape does not name, a reason outside the set, a note that is not one sentence, an entry equal
 * to an earlier one. A top level that is not `{ justified: [...] }` is one problem at index -1.
 */
export function justifiedShape(doc: unknown): {
  readonly entries: readonly JustifiedEntry[];
  readonly problems: readonly { readonly index: number; readonly message: string; readonly original?: string }[];
} {
  if (!isRecord(doc) || !Array.isArray(doc.justified))
    return { entries: [], problems: [{ index: -1, message: "wants { justified: [...] }" }] };
  const list: readonly unknown[] = doc.justified;
  const entries: JustifiedEntry[] = [];
  const problems: { index: number; message: string; original?: string }[] = [];
  const seen = new Set<string>();
  list.forEach((e, index) => {
    if (!isRecord(e)) return problems.push({ index, message: "an entry is an object" });
    const bad = (message: string): number =>
      problems.push({ index, message, ...(typeof e.original === "string" ? { original: e.original } : {}) });
    const { file, mutator, original, replacement, reason, note } = e;
    const missing = Object.entries({ file, mutator, original, replacement, reason, note })
      .filter(([k, v]) => typeof v !== "string" || (k !== "replacement" && v === ""))
      .map(([k]) => k);
    if (
      typeof file !== "string" ||
      typeof mutator !== "string" ||
      typeof original !== "string" ||
      typeof replacement !== "string" ||
      typeof reason !== "string" ||
      typeof note !== "string" ||
      missing.length > 0
    )
      return bad(`missing ${missing.join(", ")}`);
    const extra = Object.keys(e).filter(
      (k) => !["file", "mutator", "original", "replacement", "reason", "note"].includes(k),
    );
    if (extra.length > 0) return bad(`unknown field ${extra.join(", ")}`);
    if (!JUSTIFIED_REASONS.includes(reason))
      return bad(`reason ${reason} is not one of ${JUSTIFIED_REASONS.join(", ")}`);
    if (!oneSentence(note)) return bad("note is one sentence");
    const entry = { file, mutator, original, replacement, reason, note };
    if (seen.has(justifiedKey(entry))) return bad("equal to an earlier entry");
    seen.add(justifiedKey(entry));
    return entries.push(entry);
  });
  return problems.length > 0 ? { entries: [], problems } : { entries, problems };
}
