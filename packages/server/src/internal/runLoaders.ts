import type { Loader } from "@keel/router";
import type { Level } from "@keel/router/internal";
import { attempt, err, ok, pathToString } from "@keel/schema";
import type { LoaderOutcome } from "./LoaderOutcome.ts";
import type { Rec } from "./Rec.ts";
import type { Req } from "./Req.ts";
import { openStores } from "./openStores.ts";
import { unexpected } from "./unexpected.ts";

async function runOne(
  r: Req,
  id: string,
  l: Loader<unknown>,
  args: { params: Rec; search: Rec; url: string },
): Promise<LoaderOutcome> {
  const { sv, rq } = r;
  const ran = await attempt(async () => {
    const stores = l.stores === undefined ? undefined : await openStores(sv, rq, l.stores);
    return rq.scope.run(() => l.run({ ...args, caller: rq.caller.token, stores }, sv.ctx));
  });
  if (!ran.ok) return { result: ran, diag: null };
  if (!ran.value.ok) return { result: ran.value, diag: null };
  const checked = l.output.parse(ran.value.value);
  if (!checked.ok) {
    const at = checked.error.data.issues[0];
    const message = `loader ${id} data fails its output schema${at === undefined ? "" : ` at ${pathToString(at.path) || "(root)"}`}`;
    return { result: err(unexpected(`E1554 ${message}`)), diag: { code: "E1554", message } };
  }
  const json = attempt(() => l.output.encode(checked.value));
  return { result: json.ok ? ok({ value: checked.value, json: json.value }) : json, diag: null };
}

/**
 * Start every loader of `chain` together (they all start before any resolves) and collect their outcomes
 * in chain order; levels without a loader give `ok(undefined)`. Each runs in the request scope with `url` (the absolute
 * request URL), the request's `caller`, and its instance of its `stores` factory (`openStores`). A throw becomes `keel.unexpected`; data
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
