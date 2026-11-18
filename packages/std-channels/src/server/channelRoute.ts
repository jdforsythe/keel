import { stdConfig } from "@keel/compiler/std/stdConfig";
import type { Ctx } from "@keel/ctx";
import { action, loader } from "@keel/router";
import { type KeelError, attempt, err, ok, s } from "@keel/schema";
import type { Channel } from "../Channel.type.ts";
import { eventsOf } from "../internal/eventsOf.ts";
import type { ChannelRoute } from "./ChannelRoute.type.ts";
import { ChannelsConfig } from "./ChannelsConfig.ts";
import type { Member } from "./Member.ts";
import { allowed } from "./internal/allowed.ts";
import { full } from "./internal/full.ts";
import { hubOf } from "./internal/hubOf.ts";
import { inbox } from "./internal/inbox.ts";
import { join } from "./internal/join.ts";
import { paramsOf } from "./internal/paramsOf.ts";
import { reread } from "./internal/reread.ts";
import { storesIn } from "./internal/storesIn.ts";

const notFound: KeelError<"keel.notFound", null> = { code: "keel.notFound", message: "not found", data: null };
const denied: KeelError<"keel.denied", null> = { code: "keel.denied", message: "denied", data: null };
const closed = (reason: "denied" | "full") => ok({ kind: "closed", reason } as const);

/**
 * Serve `channel` (std.channels Serve) from a `*.server.ts` file (else E2601): the API route `{ id, path, loader,
 * actions: { POST } }`. The loader is a live loader: when `member` is false its only event is `closed` `denied`; past
 * the serving module's `maxStreams`, or its `perCaller` (a caller with a cookie) or `perAnonymous` (all cookieless
 * opens together), `closed` `full`; else `reset`, then `saved` after each save of a
 * store `stores` creates (with `member` re-checked against the stores as saved: false, or a failed re-read, ends it
 * with `closed` `denied`) and `message` per publish to the same channel and params, delivered after any pending
 * re-check. `POST { message }` is an action: `member` false is 403,
 * else every open member stream of the instance gets the message and it answers `ok({})`. Params that fail the
 * channel's schema are `keel.notFound`. Events name no caller and hold no store state.
 */
export function channelRoute<P, M, S>(
  channel: Channel<P, M>,
  opts: { readonly id: string; readonly stores: (ctx: Ctx) => S; readonly member: Member<P, S> },
): ChannelRoute<M, S> {
  const { id, stores, member } = opts;
  const module = id.slice(0, Math.max(0, id.indexOf(".")));
  const instance = (key: string): string => `${channel.name}\n${key}`;
  const live = loader(
    { output: eventsOf(channel.message), stores },
    async function* ({ url, caller, stores, signal }, ctx) {
      const p = paramsOf(channel.params, url);
      if (!p.ok) {
        yield err(notFound);
        return;
      }
      // `member` before the caps: a non-member learns nothing about them; it runs once per open as it does below them.
      const at = { caller, params: p.value.value, stores };
      if (!allowed(member, at)) {
        yield closed("denied");
        return;
      }
      const hub = hubOf(ctx);
      const cfg = stdConfig(ctx, "@keel/std-channels", ChannelsConfig)[module] ?? {};
      // The count and the join below run in one turn, so no other open lands between them; a stream's place is its
      // sink in the hub, which `leave` removes (a second removal is a no-op).
      if (full(hub.sinks, caller, cfg)) {
        yield closed("full");
        return;
      }
      const box = inbox<M>();
      const list = storesIn(stores);
      const ids = new Set(list.map((st) => st.id));
      let chain = Promise.resolve();
      let out = false;
      const leave = join(ctx, hub, {
        key: instance(p.value.key),
        caller,
        // Messages queue behind any pending re-check, so a stream it revokes gets none.
        post: (m) => {
          const r = channel.message?.parse(m);
          if (r?.ok === true) chain = chain.then(() => void (out || box.push({ kind: "message", message: r.value })));
        },
        // A re-read or `member` that fails is a denial; the chain goes on for later saves.
        saved: (store, head, read) => {
          if (!ids.has(store)) return;
          chain = chain.then(async () => {
            if (out) return;
            const still = await attempt(async () => (await reread(list, read)) && allowed(member, at));
            out = !(still.ok && still.value);
            box.push(out ? { kind: "closed", reason: "denied" } : { kind: "saved", store, head });
          });
        },
      });
      try {
        yield ok({ kind: "reset" } as const);
        for (;;) {
          const e = await box.next(signal);
          if (e === undefined) return;
          if (e.kind === "closed") leave();
          yield ok(e);
          if (e.kind === "closed") return;
        }
      } finally {
        leave();
      }
    },
  );
  const message = channel.message;
  const POST =
    message === undefined
      ? action({ input: s.object({}), output: s.object({}), stores }, () => err(denied))
      : action(
          { input: s.object({ message }), output: s.object({}), stores },
          (input, { url, caller, stores }, ctx) => {
            const p = paramsOf(channel.params, url);
            if (!p.ok) return err(notFound);
            if (!allowed(member, { caller, params: p.value.value, stores })) return err(denied);
            const key = instance(p.value.key);
            for (const sk of hubOf(ctx).sinks) if (sk.key === key) sk.post(input.message);
            return ok({});
          },
        );
  return Object.freeze({ id, path: channel.path, loader: live, actions: Object.freeze({ POST }) });
}
