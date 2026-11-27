import type { Ctx } from "@keel/ctx";
import { attempt } from "@keel/schema";
import { Rejected } from "../../internal/Rejected.schema.ts";
import type { FollowReport } from "./FollowReport.ts";
import type { Followed } from "./Followed.ts";

/** How long a stream waits on `ctx.clock` for every followed capability to be listening. */
const LISTEN_MS = 5_000;

/**
 * Follows `channel` at `key` on each of `follows` for `ctx`, reporting to `on`. Resolves the stop of them all once
 * every one is listening, or `undefined` when one refused or was not listening within 5,000 ms on `ctx.clock` (each
 * that did listen is stopped then).
 */
export async function followAll(
  ctx: Ctx,
  follows: readonly Followed[],
  channel: { readonly name: string; readonly params: unknown },
  key: string,
  on: (report: FollowReport) => void,
): Promise<(() => void) | undefined> {
  if (follows.length === 0) return () => undefined;
  const stops: (() => void)[] = [];
  let late = false;
  const stopAll = (): void => {
    for (const stop of stops.splice(0)) stop();
  };
  const listening = Promise.all(
    follows.map(async (cap) => {
      const stop = await cap(ctx).follow(channel, key, on);
      if (late) stop();
      else stops.push(stop);
    }),
  );
  const timer = new AbortController();
  const timeout = attempt(
    () => ctx.clock.after(LISTEN_MS, timer.signal),
    (x) => (x === timer.signal.reason ? Rejected.make({}) : undefined),
  ).then(() => "late" as const);
  const won = await Promise.race([
    attempt(
      () => listening,
      (x) => (x instanceof Error ? Rejected.make({}) : undefined),
    ).then((r) => (r.ok ? "on" : "refused")),
    timeout,
  ]);
  timer.abort();
  if (won === "on") return stopAll;
  late = true;
  stopAll();
  return undefined;
}
