import type { Ctx } from "@keel/ctx";
import type { Loader } from "@keel/router";
import type { Level } from "@keel/router";
import { attempt, err, ok, pathToString } from "@keel/schema";
import type { LoaderOutcome } from "./LoaderOutcome.ts";
import type { Rec } from "./Rec.ts";
import { unexpected } from "./unexpected.ts";

async function runOne(
  id: string,
  l: Loader<unknown>,
  args: { params: Rec; search: Rec; url: string },
  ctx: Ctx,
): Promise<LoaderOutcome> {
  const ran = await attempt(() => l.run(args, ctx));
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
 * in chain order; levels without a loader give `ok(undefined)`. Each gets `url`, the absolute request URL. A throw becomes `keel.unexpected`; data
 * failing `output` is `keel.unexpected` with an E1554 diag.
 */
export function runLoaders(
  chain: readonly Level[],
  args: { params: Rec; search: Rec; url: string },
  ctx: Ctx,
): Promise<LoaderOutcome[]> {
  return Promise.all(
    chain.map(
      (lvl): Promise<LoaderOutcome> =>
        lvl.def.loader === undefined
          ? Promise.resolve({ result: ok({ value: undefined, json: null }), diag: null })
          : runOne(lvl.id, lvl.def.loader, args, ctx),
    ),
  );
}
