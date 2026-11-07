import type { Match } from "@keel/router/internal";
import { fieldsError } from "@keel/router/internal";
import { attempt, err, ok } from "@keel/schema";
import type { Handled } from "./Handled.ts";
import type { Req } from "./Req.ts";
import { inRequest } from "./inRequest.ts";
import { isVerb } from "./isVerb.ts";
import { jsonResponse } from "./jsonResponse.ts";
import { nearestErrorElement } from "./nearestErrorElement.ts";
import { openStores } from "./openStores.ts";
import { page } from "./page.ts";
import { payloadTooLarge } from "./payloadTooLarge.ts";
import { publicError } from "./publicError.ts";
import { readCapped } from "./readCapped.ts";
import { redirectResponse } from "./redirectResponse.ts";
import { saveStores } from "./saveStores.ts";
import { statusOf } from "./statusOf.ts";
import { stringRecord } from "./stringRecord.ts";
import { valuesOf } from "./valuesOf.ts";

/**
 * POST, PUT, PATCH, DELETE (k.server Request flow): the verb is the method, or a POST's `_method` field (k.router
 * Form). A body over `maxBody` bytes is 413 `keel.payloadTooLarge`, action not called. FormData is decoded with the action's input schema; a `content-type: application/json` body (a k.services
 * client) is parsed with it instead (either fail: `keel.fields`, 422, action not called);
 * the action runs with `caller` and its `stores` instance (`openStores`); its `ok` saves the changed stores (`saveStores`,
 * else `keel.conflict`); `ok(href)` is 303 to `href`, `ok(null)` 303 to the request URL; runtime requests get
 * the `Result` as JSON with the status of its code. A document `keel.fields` re-renders the page at 422
 * with the submitted values and messages (k.forms); any other `err` renders at the route's errorElement.
 */
export async function runAction(r: Req, m: Match & { kind: "route" }): Promise<Handled> {
  const { id, def, chain } = m.route;
  const json = (r.raw.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json");
  // The body is read once, capped at `sv.maxBody` bytes (over it: 413 `keel.payloadTooLarge`, nothing runs).
  const bytes = await readCapped(r.raw, r.sv.maxBody);
  if (bytes === null) return { response: payloadTooLarge(r.sv.maxBody), route: id, diags: [] };
  const typed = new Response(bytes, { headers: { "content-type": r.raw.headers.get("content-type") ?? "" } });
  // A JSON body (a `@keel/services` client, k.services Encoding) carries no `_method`.
  const sent = json ? await attempt((): Promise<unknown> => typed.json()) : null;
  const read = json ? null : await attempt(() => typed.formData());
  const form = read?.ok === true ? read.value : new FormData();
  const override = r.method === "POST" ? form.get("_method") : null;
  const verb = typeof override === "string" ? override.toUpperCase() : r.method;
  form.delete("_method");
  const action = isVerb(verb) ? def.actions?.[verb] : undefined;
  if (action === undefined) {
    const allow = ["GET", "HEAD", ...Object.keys(def.actions ?? {})].join(", ");
    return { response: new Response(null, { status: 405, headers: { allow } }), route: id, diags: [] };
  }
  const values = valuesOf(form);
  const decoded =
    sent === null ? action.input.decodeStrings(form) : action.input.parse(sent.ok ? sent.value : undefined);
  if (!decoded.ok) {
    const e = fieldsError(action.input.node, decoded.error);
    if (r.runtime) return { response: jsonResponse(422, err(e)), route: id, diags: [] };
    return page(r, m, 422, null, { route: id, method: verb, values, errors: e.data });
  }
  // The action gets this request's instance of its `stores` factory; its `ok` saves the changed stores (or is
  // `keel.conflict`), anything else drops the instances unsaved so a re-render reads storage (k.server Server state).
  const { sv, rq } = r;
  const ran = await attempt(async () => {
    const stores = action.stores === undefined ? undefined : await openStores(sv, rq, action.stores);
    const at = { params: m.params, url: r.raw.url, caller: rq.caller.id, stores };
    const out = await inRequest(rq, () => action.run(decoded.value, at, sv.ctx));
    if (!out.ok) return out;
    const clash = await saveStores(sv, rq);
    return clash === null ? out : err(clash);
  });
  const result = ran.ok ? ran.value : ran;
  if (!result.ok) rq.held.clear();
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
