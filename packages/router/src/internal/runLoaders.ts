import type { Ctx } from "@keel/ctx";
import { type KeelError, type Result, attempt, err, ok } from "@keel/schema";
import type { Loader } from "../types/Loader.ts";
import type { Level } from "./Level.ts";
import type { Rec } from "./Rec.ts";
import { STORES_SERVER_ONLY } from "./STORES_SERVER_ONLY.ts";
import { unexpected } from "./unexpected.ts";

type Outcome = Result<unknown, KeelError<string, unknown>>;

async function runOne(l: Loader<unknown>, args: { params: Rec; search: Rec; url: string }, ctx: Ctx): Promise<Outcome> {
  if (l.stores !== undefined) return err(unexpected(STORES_SERVER_ONLY));
  const r = await attempt(() => l.run({ ...args, caller: "", stores: undefined }, ctx));
  if (!r.ok) return r;
  if (!r.value.ok) return r.value;
  const checked = l.output.parse(r.value.value);
  return checked.ok ? ok(checked.value) : err(unexpected("E1554 loader data fails its output schema"));
}

/**
 * Start every loader of `chain` in chain order, concurrently, and collect their Results (levels without a
 * loader give `ok(undefined)`); each gets the absolute `url` and `caller: ""` (no request). A throw, or a loader naming `stores` (server state, k.server),
 * becomes `keel.unexpected`; data failing `output` is E1554.
 */
export function runLoaders(
  chain: readonly Level[],
  args: { params: Rec; search: Rec; url: string },
  ctx: Ctx,
): Promise<Outcome[]> {
  return Promise.all(
    chain.map((lvl) =>
      lvl.def.loader === undefined ? Promise.resolve(ok(undefined)) : runOne(lvl.def.loader, args, ctx),
    ),
  );
}
