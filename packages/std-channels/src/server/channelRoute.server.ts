import { stdConfig } from "@keel/compiler/std/stdConfig";
import { type Ctx, supervise } from "@keel/ctx";
import { action, loader } from "@keel/router";
import type { Contract } from "@keel/router/contract";
import { defect, err, keelError, ok } from "@keel/schema";
import { holds } from "../../unsafe/holds.ts";
import type { Channel } from "../Channel.type.ts";
import type { ChannelEntries } from "../ChannelEntries.type.ts";
import type { ChannelEvent } from "../ChannelEvent.ts";
import type { PublishEntry } from "../internal/PublishEntry.ts";
import { Rejected } from "../internal/Rejected.schema.ts";
import type { StreamEntry } from "../internal/StreamEntry.ts";
import type { ChannelRoute } from "./ChannelRoute.type.ts";
import { ChannelsConfig } from "./ChannelsConfig.schema.ts";
import type { Member } from "./Member.ts";
import type { Followed } from "./internal/Followed.ts";
import { allowed } from "./internal/allowed.ts";
import { canonicalJson } from "./internal/canonicalJson.ts";
import { followAll } from "./internal/followAll.ts";
import { full } from "./internal/full.ts";
import { hubOf } from "./internal/hubOf.ts";
import { inbox } from "./internal/inbox.ts";
import { join } from "./internal/join.ts";
import { paramsOf } from "./internal/paramsOf.ts";
import { reread } from "./internal/reread.ts";
import { storesIn } from "./internal/storesIn.ts";
import { watchStores } from "./internal/watchStores.ts";

const denied = keelError.denied.make({}, "denied");
const closed = (reason: "denied" | "full") => ok({ kind: "closed", reason } as const);
/** How long an answer of `currentUser()` stands for a stream, on `ctx.clock` (std.channels Serve). */
const STANDS_MS = 1_000;

type Opts<P, S, Id extends string> = {
  readonly id: Id;
  readonly stores?: (ctx: Ctx) => S;
  readonly follows?: readonly Followed[];
  readonly member: Member<P, S>;
};

type Want = Readonly<Record<string, unknown>>;

/** True when `schema` is a schema that takes `{}`, as the publish entry's `output` must (std.contracts). */
function takesNothing(schema: unknown): boolean {
  const parse: unknown = typeof schema === "object" && schema !== null ? Reflect.get(schema, "parse") : undefined;
  if (typeof parse !== "function") return false;
  const r: unknown = Reflect.apply(parse, schema, [{}]);
  return typeof r === "object" && r !== null && Reflect.get(r, "ok") === true;
}

/**
 * The members of the entry at `id` in `c` that are not `want`'s, by identity, and, with `nothing`, an `output` that
 * does not take `{}`; `["entry"]` when there is none.
 */
function differing(c: Contract, id: string, want: Want, nothing: boolean): string[] {
  const entry: unknown = Reflect.get(c.entries, id);
  if (typeof entry !== "object" || entry === null) return ["entry"];
  const out = Object.keys(want).filter((k) => Reflect.get(entry, k) !== want[k]);
  return nothing && !takesNothing(Reflect.get(entry, "output")) ? [...out, "output"] : out;
}

/** `c` read as holding the channel's entry at `id`; E1515 naming the members that differ when it does not. */
function holding<E extends object>(
  c: Contract,
  id: string,
  want: Want,
  nothing = false,
): Contract<string, Readonly<Record<string, E>>> {
  const members = differing(c, id, want, nothing);
  if (members.length === 0) return holds<E>(c);
  return defect("channelRoute: a contract entry is not its channel's", {
    code: "E1515",
    data: { module: c.module, entry: id, members },
  });
}

/** A channel without `message`: the stream entry's loader only; `publish` does not compile. */
export function channelRoute<P, S, const Id extends string>(
  contract: NoInfer<Contract<string, ChannelEntries<P, never, Id, never>>>,
  channel: Channel<P, never>,
  opts: Opts<P, S, Id> & { readonly publish?: undefined },
): ChannelRoute<never, Id, never>;
/** A channel with `message`: the stream entry's loader and, at `publish`, required, the publish action. */
export function channelRoute<P, M, S, const Id extends string, const Pub extends string>(
  contract: NoInfer<Contract<string, ChannelEntries<P, M, Id, Pub>>>,
  channel: Channel<P, M>,
  opts: Opts<P, S, Id> & { readonly publish: [M] extends [never] ? never : Pub },
): ChannelRoute<M, Id, Pub>;
/**
 * Serve `channel` (std.channels Serve) from a `*.server.ts` file (else E2601): its handlers, `{ loader, action }`,
 * which the serving module's `manifest` binds at `id` and `publish` (`{ loader }` alone without `message`). The
 * handlers are declared through `contract`, the serving module's, as `loader` and `action` are. Its entry at `id`
 * must be `{ method: 'GET', path, query: params, events: true, output: events }` and at `publish` `{ method: 'POST',
 * path, query: params, body, output }` with `output` taking `{}`, `path`, `params`, `events` and `body` the
 * channel's own (std.contracts): another contract is a type error and throws E1515 naming the members that differ. At
 * `id` a live loader: when `member` is false its only event is `closed` `denied`; past a cap (std.channels-limits:
 * the serving module's `maxStreams` over its streams; its `perCaller` over one signed-in user's streams on it, else
 * over one caller's; its `perAnonymous` over the streams with no user and no caller of every module served on the
 * ctx), `closed` `full`; else it follows each `follows`
 * entry at the canonical JSON of its params, then yields `reset`, then `saved` after each save of a store `stores`
 * creates (with `member` re-checked against the stores as saved: false, or a failed re-read, ends it with `closed`
 * `denied`), `changed` after each followed change (with `member` re-run first) and `message` per publish to the same
 * channel and params, delivered after any pending re-check. Before each delivery the stream asks `currentUser()`
 * (k.user), an answer less than 1,000 ms old on `ctx.clock` standing for that stream; an answer other than the
 * stream's `user` gives `closed` `denied` in place of the event. A `fixed` `currentUser` (no identity source) is never
 * asked. An entry not listening within 5,000 ms on `ctx.clock`, or
 * a `lost` report, ends the stream with no `closed` event, a drop its client reopens after. At `publish` the action of `POST { message }`: `member` false is 403, else every open member
 * stream of the instance gets the message and it answers `ok({})`. The server answers params failing the channel's
 * schema with 422 before either runs. Events name no caller and hold no store state. Throws E1510 for a `publish` on
 * a channel without `message`.
 */
export function channelRoute<P, M, S>(
  contract: Contract,
  channel: Channel<P, M>,
  opts: Opts<P, S, string> & { readonly publish?: string | undefined },
): object {
  const { id, publish, stores, follows = [], member } = opts;
  const decl: { readonly stores?: (ctx: Ctx) => S } = stores === undefined ? {} : { stores };
  const { module } = contract;
  const { path, params: query, events: output, body, message } = channel;
  if (publish !== undefined && (message === undefined || body === undefined)) {
    return defect("channelRoute: the channel declares no message, so publish has nothing to publish", {
      code: "E1510",
      data: { channel: channel.name, publish },
    });
  }
  const streams = holding<StreamEntry<P, M>>(contract, id, { method: "GET", path, query, events: true, output });
  const instance = (key: string): string => `${channel.name}\n${key}`;
  const keyOf = (params: P): string => JSON.stringify(channel.params.encode(params));
  const live = loader(streams, id, decl, async function* ({ search, caller, user, stores, signal, currentUser }, ctx) {
    // `member` before the caps: a non-member learns nothing about them; it runs once per open as it does below them.
    const at = { caller, user, params: search, stores };
    if (!allowed(ctx, member, at)) {
      yield closed("denied");
      return;
    }
    const hub = hubOf(ctx);
    const cfg = stdConfig(ctx, "@keel/std-channels", ChannelsConfig)[module] ?? {};
    // The count and the join below run in one turn, so no other open lands between them; a stream's place is its
    // sink in the hub, which `leave` removes (a second removal is a no-op).
    // A signed-in stream counts as its `user` (a key no caller hash matches: base64url holds no `:`), else as its
    // caller; only a stream with neither counts as `""`, the anonymous count.
    const counted = user === "" ? caller : `user:${user}`;
    if (full(hub.sinks, counted, module, cfg)) {
      yield closed("full");
      return;
    }
    const box = inbox<M>();
    const list = storesIn(stores);
    const ids = new Set(list.map((st) => st.id));
    let chain = Promise.resolve();
    let out = false;
    type Event = ChannelEvent<M>;
    type Step = Promise<void> | undefined;
    /** `event`, or `closed` `denied` in its place; a closed stream gets nothing after. */
    const verdict = (event: Event, still: boolean): undefined => {
      out = !still;
      box.push(out ? { kind: "closed", reason: "denied" } : event);
      return undefined;
    };
    // Decided once, at open: with nothing to judge (`currentUser.fixed`: no identity source, or a verified `x-keel-user`)
    // a member's event goes out as is, with no identity code, clock read or promise on its path. Else the request the
    // stream opened with is asked again before each delivery, an answer less than a second old standing; a
    // `currentUser()` that fails is a denial. Run inside `chain`, so one stream's checks keep its order and run apart
    // from other streams'.
    let checked: number | undefined;
    const judge: (event: Event, isMember: boolean) => Step = currentUser.fixed
      ? verdict
      : (event, isMember) => {
          if (!isMember) return verdict(event, false);
          if (checked !== undefined && ctx.clock.now() - checked < STANDS_MS) return verdict(event, true);
          return (async (): Promise<void> => {
            const now = await supervise(ctx, "channels.member", () => currentUser(), Rejected.make({}));
            if (!now.ok) {
              verdict(event, false);
              return;
            }
            checked = ctx.clock.now();
            verdict(event, now.value === user);
          })();
        };
    /** `event` after `member` and, when there is one to judge, the user check; a member check that fails is a denial. */
    const deliver = (event: Event, member: () => Promise<boolean> | boolean): Step => {
      if (out) return;
      // The wrapper object keeps a returned promise from being awaited by `supervise`: only a synchronous throw is taken.
      const asked = supervise(ctx, "channels.member", () => ({ answer: member() }), Rejected.make({}));
      if (!asked.ok) return verdict(event, false);
      const m = asked.value.answer;
      return typeof m === "boolean"
        ? judge(event, m)
        : (async (): Promise<void> => {
            const isMember = await supervise(ctx, "channels.member", () => m, Rejected.make({}));
            if (!isMember.ok) {
              verdict(event, false);
              return;
            }
            await judge(event, isMember.value);
          })();
    };
    const leave = join(ctx, hub, {
      key: instance(keyOf(search)),
      caller: counted,
      module,
      // Messages queue behind any pending re-check, so a stream it revokes gets none.
      post: (m) => {
        const r = channel.message?.parse(m);
        if (r?.ok === true) chain = chain.then(() => deliver({ kind: "message", message: r.value }, () => true));
      },
      // A re-read or `member` that fails is a denial; the chain goes on for later saves.
      saved: (store, head, read) => {
        if (!ids.has(store)) return;
        const last = delivered.get(store) ?? Number.NEGATIVE_INFINITY;
        if (head === last) return;
        delivered.set(store, head);
        // A head below the last delivered: the store's count restarted (its storage was replaced), so the client re-reads.
        if (head < last) {
          chain = chain.then(() => deliver({ kind: "reset" }, () => allowed(ctx, member, at)));
          return;
        }
        chain = chain.then(() =>
          deliver({ kind: "saved", store, head }, async () => (await reread(list, read)) && allowed(ctx, member, at)),
        );
      },
    });
    // A `lost` report or a follow not listening in time ends the stream as a drop: no `closed`, so the client reopens.
    const drop = new AbortController();
    const recheck = (): void => {
      chain = chain.then(() => deliver({ kind: "changed" }, () => allowed(ctx, member, at)));
    };
    // Heads a stream delivered, per store: local and remote saves of one store reach it as one rising sequence.
    const delivered = new Map<string, number>();
    const unfollow = await followAll(ctx, follows, channel, canonicalJson(channel.params.encode(search)), (r) => {
      if (r.kind === "changed") recheck();
      else drop.abort();
    });
    // A route with `stores` on a storage with `watch` is watching before `reset` (k.persist Watch).
    const unwatch =
      unfollow === undefined || decl.stores === undefined ? undefined : await watchStores(ctx, hub, () => drop.abort());
    const until = AbortSignal.any([signal, drop.signal]);
    try {
      if (unfollow === undefined || drop.signal.aborted) return;
      if (decl.stores !== undefined && unwatch === undefined) return;
      yield ok<ChannelEvent<M>>({ kind: "reset" });
      for (;;) {
        const e = await box.next(until);
        if (e === undefined) return;
        if (e.kind === "closed") leave();
        yield ok(e);
        if (e.kind === "closed") return;
      }
    } finally {
      unfollow?.();
      unwatch?.();
      leave();
    }
  });
  if (publish === undefined || body === undefined) return Object.freeze({ loader: live });
  const send = action(
    holding<PublishEntry<P, M>>(contract, publish, { method: "POST", path, query, body }, true),
    publish,
    decl,
    (body, { url, caller, user, stores }, ctx) => {
      const p = paramsOf(channel.params, url);
      if (!p.ok || !allowed(ctx, member, { caller, user, params: p.value.value, stores })) return err(denied);
      const key = instance(p.value.key);
      for (const sk of hubOf(ctx).sinks) if (sk.key === key) sk.post(body.message);
      return ok({});
    },
  );
  return Object.freeze({ loader: live, action: send });
}
