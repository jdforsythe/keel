import type { Edit, Finding } from "@keel/check";

/** The edits of a `runnersFindings` finding: the name into the array, its import at the top when missing. */
export function runnersEdits(f: Finding): Edit[] | null {
  const { at, text, head } = f.data ?? {};
  if (typeof at !== "number" || typeof text !== "string") return null;
  const edits: Edit[] = [{ start: at, end: at, text }];
  if (typeof head === "string" && head !== "") edits.unshift({ start: 0, end: 0, text: head });
  return edits;
}
