import type { Loader } from "@keel/router";
import type { Level } from "@keel/router/internal";
import { attempt, err, ok } from "@keel/schema";
import type { LoaderOutcome } from "./LoaderOutcome.ts";
import type { Rec } from "./Rec.ts";
import type { Req } from "./Req.ts";
import { caught } from "./caught.ts";
import { notePii } from "./notePii.ts";
import { openFactory } from "./openFactory.ts";
import { outputRefused } from "./outputRefused.ts";
import { scrubbedCause } from "./scrubbedCause.ts";

async function runOne(
  r: Req,
  id: string,
  l: Loader<unknown>,
  args: { params: Rec; search: Rec; url: string },
): Promise<LoaderOutcome> {
  const { sv, rq } = r;
  const { result: ran, frames } = await caught(async () => {
    const stores = l.stores === undefined ? undefined : await openFactory(sv.ctx, rq, l.stores);
    const at = { ...args, caller: rq.caller.id, stores };
    return rq.scope.run(() => l.run(rq.bearer === undefined ? at : { ...at, bearer: rq.bearer }, sv.ctx));
  }, sv.frames);
  if (!ran.ok) {
    const clean = scrubbedCause(ran.error, rq);
    const lead = `loader ${id} threw: `;
    return { result: err(clean), diag: { code: "keel.unexpected", lead, message: lead + clean.data.cause, frames } };
  }
  if (!ran.value.ok) return { result: ran.value, diag: null };
  const checked = l.output.parse(ran.value.value);
  if (!checked.ok) {
    const refused = outputRefused("loader", id, l.output, checked.error);
    return { result: err(refused.error), diag: refused.diag };
  }
  const json = attempt(() => l.output.encode(checked.value));
  if (json.ok) notePii(rq.pii, l.output, json.value);
  return { result: json.ok ? ok({ value: checked.value, json: json.value }) : json, diag: null };
}

/**
 * Start every loader of `chain` together (they all start before any resolves) and collect their outcomes
 * in chain order; levels without a loader give `ok(undefined)`. Each runs in the request scope with `url` (the absolute
 * request URL), the request's `caller` and `bearer` (k.api Bearer), and its instance of its `stores` factory (`openFactory`). A throw becomes
 * `keel.unexpected` with a `keel.unexpected` diag carrying its app `frames` (`caught`), both without the request's `.pii()` values and revealed secrets (`scrubbedCause`; its `lead`, `loader <id> threw: `, is what `scrubbedDiag` keeps past a scrub cap); each
 * output's `.pii()` values join the request's (`notePii`); data
 * failing `output` is `keel.unexpected` with an E1554 diag.
 */
export function runLoaders(
  r: Req,
  chain: readonly Level[],
  args: { params: Rec; search: Rec; url: string },
): Promise<LoaderOutcome[]> {
  return Promise.all(
    chain.map(
      (lvl): Promise<LoaderOutcome> =>
        lvl.def.loader === undefined
          ? Promise.resolve({ result: ok({ value: undefined, json: null }), diag: null })
          : runOne(r, lvl.id, lvl.def.loader, args),
    ),
  );
}
