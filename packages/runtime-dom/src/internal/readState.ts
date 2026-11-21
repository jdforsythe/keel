import type { KeelError } from "@keel/schema";
import type { PostedForm } from "./PostedForm.ts";
import type { ServedRoute } from "./ServedRoute.ts";
import { isRecord } from "./isRecord.ts";
import { readError } from "./readError.ts";
import { readForm } from "./readForm.ts";
import { readRoute } from "./readRoute.ts";

/**
 * Read `<script type="application/json" id="k-state">` under `root` (else in its document), with its served `route`
 * the served page's failed loader `error`, if any, and the rejected post it re-renders (`form`, posted to the route's `href`).
 */
export function readState(
  root: Element,
  warnings: string[],
): {
  stores: Record<string, unknown>;
  islands: Record<string, unknown>;
  route: ServedRoute | null;
  error: KeelError<string, { readonly at?: string }> | null;
  form: PostedForm | null;
} {
  const empty = { stores: {}, islands: {}, route: null, error: null, form: null };
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
  const route = readRoute(raw.route);
  return {
    stores: isRecord(raw.stores) ? raw.stores : {},
    islands: isRecord(raw.islands) ? raw.islands : {},
    route,
    error: readError(raw.error),
    form: route === null ? null : readForm(raw.form, route.href),
  };
}
