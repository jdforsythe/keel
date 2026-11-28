// Shared fixtures for the rfc:0192 std.postgres conformance files (not a test file).
// Assumption: `changed(channel, params)` is a method of the database object and of `tx`; `follow(channel, key, on)` is a method of the database object. Neither is typed in the package yet, so each is reached through `Reflect.get` and checked at runtime.
// Assumption: `channel` is a plain `{ name, params }` (the spec: "any value with `name` and a `params` schema"); `key` of `follow` is the canonical JSON text of the params (keys sorted), as `changed` keys them.
// Assumption: a follow's delivery over a socket is awaited with `vi.waitFor` (bounded); a delivery that must NOT happen is shown by a later commit on the same connection arriving (`flush`), since notifications arrive in commit order.
import { testTime } from "@keel/tooling/test-time";
import type { KeelError, Result } from "@keel/schema";
import { err, ok, s } from "@keel/schema";
import { expect, vi } from "vitest";

export const boardChannel = { name: "board.list", params: s.object({ b: s.string() }) };
export const otherChannel = { name: "board.other", params: s.object({ b: s.string() }) };
export const pairChannel = { name: "board.pair", params: s.object({ a: s.int(), b: s.int() }) };
const flushChannel = { name: "board.flush", params: s.object({ n: s.int() }) };

export type Chan = { readonly name: string; readonly params: unknown };
export type FollowEvent = { kind: "changed" } | { kind: "lost" };

/** The canonical JSON (keys sorted) of a flat object's params. */
export const canonical = (params: Record<string, unknown>): string =>
  JSON.stringify(Object.fromEntries(Object.entries(params).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))));
export const keyOf = (b: string): string => canonical({ b });

function method(target: object, name: string): (...args: unknown[]) => unknown {
  const fn: unknown = Reflect.get(target, name);
  if (typeof fn !== "function") throw new Error(`the target has no \`${name}\``);
  return (...args) => Reflect.apply(fn, target, args);
}

/** `target.changed(channel, params)` for a database object or a `tx`; a throw is a rejection. */
export async function changed(
  target: object,
  channel: Chan,
  params: unknown,
): Promise<Result<null, KeelError<string, unknown>>> {
  const r: unknown = await method(target, "changed")(channel, params);
  if (typeof r !== "object" || r === null || typeof Reflect.get(r, "ok") !== "boolean")
    throw new Error("changed answered no Result");
  if (Reflect.get(r, "ok") === true) return ok(null);
  const e: unknown = Reflect.get(r, "error");
  if (
    typeof e !== "object" ||
    e === null ||
    typeof Reflect.get(e, "code") !== "string" ||
    typeof Reflect.get(e, "message") !== "string" ||
    !Object.hasOwn(e, "data")
  )
    throw new Error("changed answered an err that is no KeelError");
  return err({
    code: String(Reflect.get(e, "code")),
    message: String(Reflect.get(e, "message")),
    data: Reflect.get(e, "data"),
  });
}

export interface Watch {
  readonly events: FollowEvent[];
  stop(): void;
}

/** `db.follow(channel, key, on)`, resolved once listening, recording each event. */
export async function watch(
  db: object,
  channel: Chan,
  key: string,
  also: (e: FollowEvent) => void = () => undefined,
): Promise<Watch> {
  const events: FollowEvent[] = [];
  const stop = await method(db, "follow")(channel, key, (e: FollowEvent) => {
    events.push(e);
    also(e);
  });
  if (typeof stop !== "function") throw new Error("follow returned no stop function");
  return { events, stop: () => Reflect.apply(stop, undefined, []) };
}

export const until = (pred: () => boolean): Promise<void> =>
  vi.waitFor(() => expect(pred()).toBe(true), { timeout: testTime(15_000), interval: 5 });

let flushes = 0;
/** Commits one change on a channel of its own and waits for it: every earlier commit on the connection has been delivered by then. */
export async function flush(db: object): Promise<void> {
  flushes += 1;
  const n = flushes;
  const w = await watch(db, flushChannel, canonical({ n }));
  const r = await changed(db, flushChannel, { n });
  if (!(typeof r === "object" && r !== null && Reflect.get(r, "ok") === true)) throw new Error("flush: changed failed");
  await until(() => w.events.length >= 1);
  w.stop();
}
