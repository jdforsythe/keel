import type { Ctx } from "@keel/ctx";
import { attempt, err } from "@keel/schema";
import { asClient } from "../unsafe/asClient.ts";
import type { Client } from "./Client.ts";
import type { EndpointMap } from "./EndpointMap.ts";
import type { ServiceOptions } from "./ServiceOptions.ts";
import { call } from "./internal/call.ts";
import { fail } from "./internal/fail.ts";

const DEFAULT_TIMEOUT = 10_000;

function positive(ms: number, where: string): number {
  if (!Number.isFinite(ms) || ms <= 0) throw new RangeError(`${where} timeout needs a finite ms > 0, got ${ms}`);
  return ms;
}

/**
 * Build a typed client (k.services): one method `(input, ctx) => Promise<Result<Out, ApiError>>` per endpoint.
 * Requests go through `ctx.net.fetch`. Throws at construction on a non-absolute `base` or a timeout that is not
 * a finite ms > 0; a call never throws.
 */
export function service<const D extends EndpointMap>(opts: ServiceOptions<D>): Client<D> {
  const fallback = positive(opts.timeout ?? DEFAULT_TIMEOUT, "service");
  if (!attempt(() => new URL(opts.base)).ok) throw new Error(`service base is not an absolute URL: ${opts.base}`);
  const methods = Object.fromEntries(
    Object.entries(opts.schema).map(([name, e]) => {
      const ms = e.timeout === undefined ? fallback : positive(e.timeout, name);
      const method = async (input: unknown, ctx: Ctx) => {
        const r = await attempt(() => call(e, opts.base, ms, input, ctx));
        return r.ok ? r.value : err(fail.network());
      };
      return [name, method];
    }),
  );
  return asClient<D>(Object.freeze(methods));
}
