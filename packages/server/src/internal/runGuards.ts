import { carriedParams, encodeHref, guardLoop, guardNext, matchUrl, withNext } from "@keel/router/internal";
import type { Level } from "@keel/router/internal";
import { needsBare } from "@keel/router/internal";
import type { KeelError, Secret } from "@keel/schema";
import type { Diag } from "./Diag.ts";
import type { GuardOutcome } from "./GuardOutcome.ts";
import type { RequestScope } from "./RequestScope.ts";
import type { Served } from "./Served.ts";
import { attempted } from "./attempted.ts";
import { caught } from "./caught.ts";
import { nearestErrorElement } from "./nearestErrorElement.ts";
import { scrubbedCause } from "./scrubbedCause.ts";
import { unexpected } from "./unexpected.ts";

type Step =
  | { readonly kind: "pass" }
  | {
      readonly kind: "fail";
      readonly at: number;
      readonly error: KeelError<string, unknown>;
      readonly diags?: readonly Diag[];
    }
  | { readonly kind: "redirect"; readonly at: number; readonly location: string };

/**
 * The guards of `chain` for `url`, outermost first, up to the first that does not pass. A throw is `keel.unexpected`
 * without the request's `.pii()` values and revealed secrets (`scrubbedCause`) plus a `keel.unexpected` diag with its
 * app `frames` and its `lead`, `guard <id> threw: `, which `scrubbedDiag` keeps past a scrub cap.
 */
async function step(
  chain: readonly Level[],
  url: string,
  params: Readonly<Record<string, unknown>>,
  sv: Served,
  rq: RequestScope,
  bearer?: Secret<string>,
): Promise<Step> {
  const { byId, table } = sv;
  const who = { caller: rq.caller.id, user: rq.user };
  for (const [i, lvl] of chain.entries()) {
    const g = lvl.def.guard;
    if (g === undefined) continue;
    const ran = await caught(
      () => g.run(bearer === undefined ? { url, ...who } : { url, ...who, bearer }, sv.ctx),
      sv.frames,
    );
    if (!ran.result.ok) {
      const clean = scrubbedCause(ran.result.error, rq);
      const lead = `guard ${lvl.id} threw: `;
      const diag = { code: "keel.unexpected", lead, message: lead + clean.data.cause, frames: ran.frames };
      return { kind: "fail", at: i, error: clean, diags: [diag] };
    }
    const r = ran.result.value;
    if (r.ok) continue;
    if (r.error.code !== "keel.denied") return { kind: "fail", at: i, error: r.error };
    const id = g.redirect;
    // An API route's denial is 403 (k.api): no redirect is followed, so none is resolved.
    if (lvl.def.kind === "api" || id === undefined) return { kind: "redirect", at: i, location: "" };
    const target = byId.get(id)?.def;
    const carried = carriedParams(id, target, params);
    if (!carried.ok)
      return {
        kind: "fail",
        at: i,
        error: unexpected(carried.error),
        diags: [{ code: "E1508", message: carried.error.slice(6, 95) }],
      };
    const to = attempted(() => encodeHref(id, target, carried.value, {}));
    if (!to.ok)
      return {
        kind: "fail",
        at: i,
        error: unexpected(`guard redirect to "${id}" failed: ${scrubbedCause(to.error, rq).message}`),
      };
    return { kind: "redirect", at: i, location: withNext(to.value, guardNext(table, url)) };
  }
  return { kind: "pass" };
}

/** Where the browser goes next after requesting `url`: its guards' redirect location, or `null` when none redirects. */
async function nextHop(url: string, sv: Served, rq: RequestScope): Promise<string | null> {
  const m = matchUrl(sv.table, url);
  if (m.kind !== "route") return null;
  const s = await step(m.route.chain, m.url, m.params, sv, rq);
  return s.kind === "redirect" ? s.location : null;
}

/**
 * Run every guard of `chain`, outermost first, before any loader (k.guards). `keel.denied` redirects
 * to the guard's `redirect` route with search `next` (the request path and query, or that URL's own `next` when it
 * is a guard's redirect route: never nested, `guardNext`); any other `err`, a throw fails at that level. A route's
 * `guard` is the guard value; its `redirect` resolves in the deployable's route table (`byId`).
 * Before answering a redirect, the target's guards run here, hop by hop (the browser would follow): a location
 * visited twice or a ninth redirect is E1508, a `keel.unexpected` failure at the denying level with a diag; a guard's
 * throw fails at its level, scrubbed, with a `keel.unexpected` diag (k.server Log).
 * On an API route a denial is a `redirect` with location `""`, resolved nowhere (k.api).
 * Every guard gets the request's `caller` id (`""` anonymous), its `user` (k.user) and its `bearer` (`undefined` off an API route, k.api
 * Bearer); a redirect hop's guards run without one, as the browser following it sends none. `refused`, the request's
 * `userOf` error, fails at the outermost level before any guard runs (k.user).
 */
export async function runGuards(
  chain: readonly Level[],
  url: string,
  params: Readonly<Record<string, unknown>>,
  sv: Served,
  rq: RequestScope,
  refused?: KeelError<string, unknown>,
): Promise<GuardOutcome> {
  const fail = (i: number, error: KeelError<string, unknown>, diags: readonly Diag[] = []): GuardOutcome => {
    const level = nearestErrorElement(chain, i);
    return { kind: "fail", failure: { level, bare: needsBare(chain, level), error }, diags };
  };
  if (refused !== undefined) return fail(0, refused);
  const first = await step(chain, url, params, sv, rq, rq.bearer);
  if (first.kind === "pass") return first;
  if (first.kind === "fail") return fail(first.at, first.error, first.diags);
  const visited = [url];
  let to: string | null = first.location || null;
  while (to !== null) {
    const loop = guardLoop(visited, to);
    if (loop !== null) return fail(first.at, unexpected(`E1508 ${loop}`), [{ code: "E1508", message: loop }]);
    visited.push(to);
    to = await nextHop(to, sv, rq);
  }
  return { kind: "redirect", location: first.location };
}
