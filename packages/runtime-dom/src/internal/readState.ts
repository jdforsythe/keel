import { isRecord } from "./isRecord.ts";

/** Read `<script type="application/json" id="k-state">` under `root` (else in its document). */
export function readState(
  root: Element,
  warnings: string[],
): { stores: Record<string, unknown>; islands: Record<string, unknown> } {
  const empty = { stores: {}, islands: {} };
  const script = root.querySelector("script#k-state") ?? root.ownerDocument.getElementById("k-state");
  if (script === null) return empty;
  let raw: unknown;
  try {
    raw = JSON.parse(script.textContent ?? "");
  } catch {
    warnings.push("E1253 #k-state is not valid JSON; stores keep their initial state");
    return empty;
  }
  if (!isRecord(raw)) {
    warnings.push("E1253 #k-state is not an object; stores keep their initial state");
    return empty;
  }
  return {
    stores: isRecord(raw.stores) ? raw.stores : {},
    islands: isRecord(raw.islands) ? raw.islands : {},
  };
}
