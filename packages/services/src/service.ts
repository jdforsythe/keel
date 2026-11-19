import type { Ctx } from "@keel/ctx";
import { attempt, err } from "@keel/schema";
import { asClient } from "../unsafe/asClient.ts";
import type { Client } from "./Client.ts";
import type { EndpointMap } from "./EndpointMap.ts";
import type { ServiceOptions } from "./ServiceOptions.ts";
import type { Target } from "./internal/Target.ts";
import { call } from "./internal/call.ts";
import { events } from "./internal/events.ts";
import { fail } from "./internal/fail.ts";
import { moduleTarget } from "./internal/moduleTarget.ts";

const DEFAULT_TIMEOUT = 10_000;

function positive(ms: number, where: string): number {
  if (!Number.isFinite(ms) || ms <= 0) throw new RangeError(`${where} timeout needs a finite ms > 0, got ${ms}`);
  return ms;
}

/**
 * Build a typed client (k.services): one method `(input, ctx) => Promise<Result<Out, ApiError>>` per endpoint, an
 * `AsyncIterable` of them for an `events: true` endpoint. `base` calls go through `ctx.net.fetch`; `module` calls are
 * resolved per call by k.topology (`moduleTarget`). Throws at construction on a non-absolute `base`, an empty `module`
 * or a timeout that is not a finite ms > 0; a call never throws.
 */
export function service<const D extends EndpointMap>(opts: ServiceOptions<D>): Client<D> {
  const fallback = positive(opts.timeout ?? DEFAULT_TIMEOUT, "service");
  const { base, module } = opts;
  if (base !== undefined && !attempt(() => new URL(base)).ok)
    throw new Error(`service base is not an absolute URL: ${base}`);
  if (base === undefined && (module === undefined || !/^[A-Za-z][\w-]*$/.test(module)))
    throw new Error(`service module is not a module id: ${String(module)}`);
  const target = (ctx: Ctx): Target =>
    base === undefined ? moduleTarget(ctx, module ?? "") : { base, send: (req) => ctx.net.fetch(req) };
  const methods = Object.fromEntries(
    Object.entries(opts.schema).map(([name, e]) => {
      const ms = e.timeout === undefined ? fallback : positive(e.timeout, name);
      const method = e.events
        ? (input: unknown, ctx: Ctx) => events(e, target(ctx), ms, input, ctx)
        : async (input: unknown, ctx: Ctx) => {
            const r = await attempt(() => call(e, target(ctx), ms, input, ctx));
            return r.ok ? r.value : err(fail.network());
          };
      return [name, method];
    }),
  );
  return asClient<D>(Object.freeze(methods));
}
