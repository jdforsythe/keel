import { attempt, err, ok } from "@keel/schema";
import type { Handled } from "./Handled.ts";
import type { Match } from "./Match.ts";
import type { Req } from "./Req.ts";
import { fieldsError } from "./fieldsError.ts";
import { isVerb } from "./isVerb.ts";
import { jsonResponse } from "./jsonResponse.ts";
import { nearestErrorElement } from "./nearestErrorElement.ts";
import { page } from "./page.ts";
import { publicError } from "./publicError.ts";
import { redirectResponse } from "./redirectResponse.ts";
import { statusOf } from "./statusOf.ts";
import { stringRecord } from "./stringRecord.ts";
import { valuesOf } from "./valuesOf.ts";

/**
 * POST, PUT, PATCH, DELETE (k.server Request flow): the verb is the method, or a POST's `_method` field (k.router
 * Form). FormData is decoded with the action's input schema (fail: `keel.fields`, 422, action not called);
 * the action runs; `ok(href)` is 303 to `href`, `ok(null)` 303 to the request URL; runtime requests get
 * the `Result` as JSON with the status of its code. A document `keel.fields` re-renders the page at 422
 * with the submitted values and messages (k.forms); any other `err` renders at the route's errorElement.
 */
export async function runAction(r: Req, m: Match & { kind: "route" }): Promise<Handled> {
  const { id, def, chain } = m.route;
  const read = await attempt(() => r.raw.formData());
  const form = read.ok ? read.value : new FormData();
  const override = r.method === "POST" ? form.get("_method") : null;
  const verb = typeof override === "string" ? override.toUpperCase() : r.method;
  form.delete("_method");
  const action = isVerb(verb) ? def.actions?.[verb] : undefined;
  if (action === undefined) {
    const allow = ["GET", "HEAD", ...Object.keys(def.actions ?? {})].join(", ");
    return { response: new Response(null, { status: 405, headers: { allow } }), route: id, diags: [] };
  }
  const values = valuesOf(form);
  const decoded = action.input.decodeStrings(form);
  if (!decoded.ok) {
    const e = fieldsError(action.input.node, decoded.error);
    if (r.runtime) return { response: jsonResponse(422, err(e)), route: id, diags: [] };
    return page(r, m, 422, null, { route: id, method: verb, values, errors: e.data });
  }
  const ran = await attempt(() => action.run(decoded.value, { params: m.params }, r.sv.ctx));
  const result = ran.ok ? ran.value : ran;
  if (result.ok) {
    if (r.runtime) return { response: jsonResponse(200, ok(result.value)), route: id, diags: [] };
    return { response: redirectResponse(303, result.value ?? r.raw.url), route: id, diags: [] };
  }
  const e = result.error;
  if (r.runtime)
    return { response: jsonResponse(statusOf(e.code), err(publicError(e, r.sv.mode))), route: id, diags: [] };
  if (e.code === "keel.fields")
    return page(r, m, 422, null, { route: id, method: verb, values, errors: stringRecord(e.data) });
  const level = nearestErrorElement(chain, chain.length - 1);
  return page(r, m, statusOf(e.code), { level, bare: false, error: e }, null);
}
