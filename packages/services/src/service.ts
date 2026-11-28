import type { Ctx } from "@keel/ctx";
import type { Contract } from "@keel/router/contract";
import { attempt } from "@keel/schema";
import type { Client } from "./Client.ts";
import type { ContractClient } from "./ContractClient.ts";
import type { EndpointMap } from "./EndpointMap.ts";
import type { ServiceOptions } from "./ServiceOptions.ts";
import type { Target } from "./internal/Target.ts";
import { call } from "./internal/call.ts";
import { endpointOf } from "./internal/endpointOf.ts";
import { events } from "./internal/events.ts";
import { fail } from "./internal/fail.ts";
import { keelOrigin } from "./internal/keelOrigin.ts";
import { moduleTarget } from "./internal/moduleTarget.ts";
import { serverBound } from "./internal/serverBound.ts";

const DEFAULT_TIMEOUT = 10_000;
const DEFAULT_MAX_BYTES = 1_048_576;

function positive(ms: number, where: string): number {
  if (!Number.isFinite(ms) || ms <= 0) throw new RangeError(`${where} timeout needs a finite ms > 0, got ${ms}`);
  return ms;
}

function bytes(n: number): number {
  if (!Number.isSafeInteger(n) || n <= 0) throw new RangeError(`service maxBytes needs an integer > 0, got ${n}`);
  return n;
}

/**
 * Build a typed client (k.services): one method `(input, ctx) => Promise<Result<Out, ApiError>>` per endpoint, an
 * `AsyncIterable` of them for an `events: true` endpoint. A `contract`'s calls are resolved per call by k.topology
 * (`moduleTarget`), one method per API entry named by its id after the module; a `base` service's go through
 * `ctx.net.fetch` with `redirect: "manual"`, so no redirect is followed, and carry `x-keel: 1` only to a Keel origin
 * (`keelOrigin`), with `x-keel-forwarded: 1` too from a server (`serverBound`): to a third party a request carries
 * no Keel header and no cookie. A call reads at most `maxBytes` (default
 * 1 MiB) of a response body. Throws at construction on a non-absolute `base`, a timeout that is not a finite ms > 0
 * or a `maxBytes` that is not an integer > 0; a call never throws.
 */
export function service<const C extends Contract>(opts: {
  readonly contract: C;
  readonly timeout?: number;
  readonly maxBytes?: number;
}): ContractClient<C>;
export function service<const D extends EndpointMap>(opts: {
  readonly base: string;
  readonly schema: D;
  readonly timeout?: number;
  readonly maxBytes?: number;
}): Client<D>;
export function service(opts: ServiceOptions): unknown {
  const fallback = positive(opts.timeout ?? DEFAULT_TIMEOUT, "service");
  const limit = bytes(opts.maxBytes ?? DEFAULT_MAX_BYTES);
  const { base, contract } = opts;
  if (base !== undefined && URL.parse(base) === null) throw new Error(`service base is not an absolute URL: ${base}`);
  const target = (ctx: Ctx): Target =>
    contract !== undefined
      ? moduleTarget(ctx, contract.module)
      : {
          base: base ?? "",
          keel: keelOrigin(ctx, base ?? ""),
          ...(keelOrigin(ctx, base ?? "") && serverBound(ctx) ? { server: true as const } : {}),
          send: (req) => ctx.net.fetch(new Request(req, { redirect: "manual" })),
        };
  const named: [string, unknown][] =
    contract !== undefined
      ? Object.entries(contract.entries).map(([id, e]) => [id.slice(contract.module.length + 1), e])
      : Object.entries(opts.schema ?? {});
  const methods = Object.fromEntries(
    named.flatMap(([name, entry]) => {
      const e = endpointOf(entry);
      if (e === undefined) return [];
      const ms = e.timeout === undefined ? fallback : positive(e.timeout, name);
      const method = e.events
        ? (input: unknown, ctx: Ctx) => events(e, target(ctx), ms, limit, input, ctx)
        : async (input: unknown, ctx: Ctx) => {
            return attempt(
              () => call(e, target(ctx), ms, limit, input, ctx),
              (x) => (x instanceof Error ? fail.network() : undefined),
            );
          };
      return [[name, method]];
    }),
  );
  return Object.freeze(methods);
}
