import type { Match } from "@keel/router/internal";
import { fieldsError, routeActions } from "@keel/router/internal";
import { err, ok } from "@keel/schema";
import { saveStores } from "@keel/store/internal";
import type { Diag } from "./Diag.ts";
import type { Handled } from "./Handled.ts";
import type { Req } from "./Req.ts";
import { allowOf } from "./allowOf.ts";
import { attempted } from "./attempted.ts";
import { caught } from "./caught.ts";
import { inRequest } from "./inRequest.ts";
import { isVerb } from "./isVerb.ts";
import { jsonResponse } from "./jsonResponse.ts";
import { nearestErrorElement } from "./nearestErrorElement.ts";
import { notePii } from "./notePii.ts";
import { openFactory } from "./openFactory.ts";
import { outputRefused } from "./outputRefused.ts";
import { page } from "./page.ts";
import { payloadTooLarge } from "./payloadTooLarge.ts";
import { publicError } from "./publicError.ts";
import { readCapped } from "./readCapped.ts";
import { redirectResponse } from "./redirectResponse.ts";
import { scrubbedCause } from "./scrubbedCause.ts";
import { statusOf } from "./statusOf.ts";
import { stringRecord } from "./stringRecord.ts";
import { valuesOf } from "./valuesOf.ts";

/**
 * POST, PUT, PATCH, DELETE (k.server Request flow): the verb is the method, or a POST's `_method` field (k.router
 * Form). A body over `maxBody` bytes is 413 `keel.payloadTooLarge`, action not called. FormData is decoded with the action's input schema; a `content-type: application/json` body (a k.services
 * client) is parsed with it instead, an empty one as `{}` (either fail: `keel.fields`, 422, action not called);
 * the action runs with `caller` and its `stores` instance (`openFactory`); its `ok` saves the changed stores (`saveStores`,
 * else `keel.conflict`); `ok(href)` is 303 to `href`, `ok(null)` 303 to the request URL; runtime requests get
 * the `Result` as JSON with the status of its code. An action with `output` (an API route's, k.api Output) also gets
 * the request's `bearer`; its `ok` value is parsed by `output` before any store is saved (fail: an E1554 diag naming
 * the first refused path and 500 `keel.unexpected`, nothing saved), its encoding's `.pii()` values join the request's,
 * then the stores are saved, then it answers 200 `{ ok: true, value: <encoded> }`; a conflict sends no value. A document `keel.fields` re-renders the page at 422
 * with the submitted values less secrets (`valuesOf`) and messages (k.forms); any other `err` renders at the route's errorElement.
 * A throw is `keel.unexpected` plus a `keel.unexpected` diag; neither holds a `.pii()` value of the decoded input or of
 * the stores it opened, nor the revealed value of a `Secret` in the decoded input (`notePii`, `noteRequestSecrets`,
 * `scrubbedCause`; k.privacy Server log); its `lead`, `action <id> threw: `, is what `scrubbedDiag` keeps past a scrub cap.
 */
export async function runAction(r: Req, m: Match & { kind: "route" }): Promise<Handled> {
  const { id, def, chain } = m.route;
  const json = (r.raw.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json");
  // The body is read once, capped at `sv.maxBody` bytes (over it: 413 `keel.payloadTooLarge`, nothing runs).
  const bytes = await readCapped(r.raw, r.sv.maxBody);
  if (bytes === null) return { response: payloadTooLarge(r.sv.maxBody), route: id, diags: [] };
  const typed = new Response(bytes, { headers: { "content-type": r.raw.headers.get("content-type") ?? "" } });
  // A JSON body (a `@keel/services` client, k.services Encoding) carries no `_method`; an empty one is `{}`.
  const body = async (): Promise<unknown> => (bytes.length ? typed.json() : {});
  const sent = json ? await attempted(body) : null;
  const read = json ? null : await attempted(() => typed.formData());
  const form = read?.ok === true ? read.value : new FormData();
  const override = r.method === "POST" ? form.get("_method") : null;
  const verb = typeof override === "string" ? override.toUpperCase() : r.method;
  form.delete("_method");
  const acts = routeActions.get(def);
  const action = isVerb(verb) ? acts?.[verb] : undefined;
  if (action === undefined) {
    return { response: new Response(null, { status: 405, headers: { allow: allowOf(def) } }), route: id, diags: [] };
  }
  const values = valuesOf(form, action.input.node);
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
  const encoded = attempted(() => action.input.encode(decoded.value));
  notePii(rq.pii, action.input, encoded.ok ? encoded.value : decoded.value);
  let refused: Diag | null = null;
  const { result: ran, frames } = await caught(async () => {
    const stores = action.stores === undefined ? undefined : await openFactory(sv.ctx, rq, action.stores);
    const at = { params: m.params, url: r.url, caller: rq.caller.id, stores };
    const out =
      action.output === undefined
        ? await inRequest(rq, () => action.run(decoded.value, at, sv.ctx))
        : await inRequest(rq, () =>
            action.run(decoded.value, rq.bearer === undefined ? at : { ...at, bearer: rq.bearer }, sv.ctx),
          );
    if (!out.ok) return out;
    let value = out.value;
    if (action.output !== undefined) {
      // Parsed before any save: a refused value saves nothing and is never sent.
      const checked = action.output.parse(out.value);
      if (!checked.ok) {
        const no = outputRefused("action", id, action.output, checked.error);
        refused = no.diag;
        return err(no.error);
      }
      value = action.output.encode(checked.value);
      notePii(rq.pii, action.output, value);
    }
    const clash = await saveStores(sv.ctx, rq);
    return clash === null ? ok(value) : err(clash);
  }, sv.frames);
  // A throw: the stores as the action left them hold `.pii()` values too; its message, cause and diag drop them all.
  if (!ran.ok) {
    const held = await attempted(() => Promise.all(rq.held.values()));
    for (const h of held.ok ? held.value : [])
      for (const o of h.opened) notePii(rq.pii, o.store.schema, o.store.snapshot().state);
  }
  const clean = ran.ok ? null : scrubbedCause(ran.error, rq);
  const lead = `action ${id} threw: `;
  const thrown: Diag[] =
    clean === null ? [] : [{ code: "keel.unexpected", lead, message: lead + clean.data.cause, frames }];
  if (refused !== null) thrown.push(refused);
  const result = clean === null ? (ran.ok ? ran.value : ran) : err(clean);
  if (!result.ok) rq.held.clear();
  if (result.ok) {
    if (r.runtime) return { response: jsonResponse(200, ok(result.value)), route: id, diags: thrown };
    const to = result.value;
    return { response: redirectResponse(303, typeof to === "string" ? to : r.url), route: id, diags: thrown };
  }
  const e = result.error;
  if (r.runtime)
    return { response: jsonResponse(statusOf(e.code), err(publicError(e, r.sv.mode))), route: id, diags: thrown };
  if (e.code === "keel.fields")
    return page(r, m, 422, null, { route: id, method: verb, values, errors: stringRecord(e.data) });
  const level = nearestErrorElement(chain, chain.length - 1);
  const shown = await page(r, m, statusOf(e.code), { level, bare: false, error: e }, null);
  return { ...shown, diags: [...thrown, ...shown.diags] };
}
