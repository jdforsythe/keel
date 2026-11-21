import type { Ctx } from "@keel/ctx";
import { report } from "@keel/ctx/internal";
import { type KeelError, type Result, attempt, err, ok } from "@keel/schema";
import type { ServerRequest, ServerState } from "@keel/store/internal";
import type { Loader } from "../types/Loader.ts";
import type { Level } from "./Level.ts";
import type { Rec } from "./Rec.ts";
import { STORES_SERVER_ONLY } from "./STORES_SERVER_ONLY.ts";
import { unexpected } from "./unexpected.ts";

type Outcome = Result<unknown, KeelError<string, unknown>>;

async function runOne(
  l: Loader,
  args: { params: Rec; search: Rec; url: string; caller: string; user: string },
  ctx: Ctx,
  rq: ServerRequest | undefined,
): Promise<Outcome> {
  const from = l.stores;
  if (from !== undefined && rq === undefined) return err(unexpected(STORES_SERVER_ONLY));
  const r = await attempt(async () =>
    l.run({ ...args, stores: from === undefined ? undefined : await rq?.stores(from) }, ctx),
  );
  if (!r.ok) return r;
  if (!r.value.ok) return r.value;
  const checked = l.output.parse(r.value.value);
  return checked.ok ? ok(checked.value) : err(unexpected("E1554 loader data fails its output schema"));
}

/**
 * Start every loader of `chain` in chain order, concurrently, and collect their Results (levels without a
 * loader give `ok(undefined)`); each gets the absolute `url` and the router's `caller` and `user` (`""` by default: no request). A
 * throw becomes `keel.unexpected`; data failing `output` is E1554. With `state` the run is one request: each loader
 * naming `stores` gets the request's instance of its factory, and the request ends once every loader settled; without
 * it such a loader is `keel.unexpected` (server state, k.server). Each `err` is reported to the ctx's observers (k.ctx
 * Observers).
 */
export async function runLoaders(
  chain: readonly Level[],
  args: { params: Rec; search: Rec; url: string; caller: string; user: string },
  ctx: Ctx,
  state?: ServerState,
): Promise<Outcome[]> {
  const rq = state?.request();
  const out = await Promise.all(
    chain.map(async (lvl) => {
      const r = lvl.def.loader === undefined ? ok(undefined) : await runOne(lvl.def.loader, args, ctx, rq);
      if (!r.ok) report(ctx, { kind: "error", error: r.error });
      return r;
    }),
  );
  rq?.end();
  return out;
}
