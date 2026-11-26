import { createCtx } from "@keel/ctx";
import { report } from "@keel/ctx/internal";
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import { store } from "@keel/store";
import { expect, test } from "vitest";
import type { Sink } from "../src/server/internal/Sink.ts";
import { hubOf } from "../src/server/internal/hubOf.ts";
import { join } from "../src/server/internal/join.ts";
import { reread } from "../src/server/internal/reread.ts";

const sink = (caller: string, seen: unknown[]): Sink => ({
  key: "k",
  caller,
  module: "m",
  post: () => undefined,
  saved: (store, head, read) => seen.push({ store, head, read }),
});

test("each save reported on the server ctx reaches every open sink once, in report order, with one shared read", () => {
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  const hub = hubOf(ctx);
  expect(hubOf(ctx)).toBe(hub);
  const a: unknown[] = [];
  const b: unknown[] = [];
  const leaveA = join(ctx, hub, sink("x", a));
  const leaveB = join(ctx, hub, sink("y", b));
  report(ctx, { kind: "save", store: "m.s", head: 1, from: 0 });
  report(ctx, { kind: "net", online: false });
  report(ctx, { kind: "save", store: "m.t", head: 4, from: 3 });
  expect(a.map((x) => [Reflect.get(Object(x), "store"), Reflect.get(Object(x), "head")])).toEqual([
    ["m.s", 1],
    ["m.t", 4],
  ]);
  expect(b).toHaveLength(2);
  expect(Reflect.get(Object(a[0]), "read")).toBe(Reflect.get(Object(b[0]), "read"));
  leaveA();
  report(ctx, { kind: "save", store: "m.s", head: 2, from: 1 });
  expect(a).toHaveLength(2);
  expect(b).toHaveLength(3);
  leaveB();
  expect(hub.sinks.size).toBe(0);
  expect(hub.stop).toBeUndefined();
  report(ctx, { kind: "save", store: "m.s", head: 3, from: 2 });
  expect(b).toHaveLength(3);
});

test("a shared read reads ctx.storage once per key per save", async () => {
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  await ctx.storage.set("keel.store.m.s", "1");
  const reads: Promise<string | null>[] = [];
  const leave = join(ctx, hubOf(ctx), {
    key: "k",
    caller: "",
    module: "m",
    post: () => undefined,
    saved: (_s, _h, read) => reads.push(read("keel.store.m.s"), read("keel.store.m.s")),
  });
  report(ctx, { kind: "save", store: "m.s", head: 1, from: 0 });
  expect(reads[0]).toBe(reads[1]);
  expect(await reads[0]).toBe("1");
  leave();
});

test("reread restores each store from its stored snapshot, and is false for one that does not restore", async () => {
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  const N = s.object({ n: s.int() });
  const { saved, never, other, copy } = scope(() => undefined, { detached: true }).run(() => ({
    saved: store(N, { n: 0 }, { id: "m.saved" }),
    never: store(N, { n: 5 }, { id: "m.never" }),
    other: store(N, { n: 9 }, { id: "m.other" }),
    copy: store(N, { n: 7 }, { id: "m.copy" }),
  }));
  await ctx.storage.set("keel.store.m.saved", JSON.stringify(copy.snapshot({ meta: true })));
  const read = (key: string) => ctx.storage.get(key);
  expect(await reread([saved, never], read)).toBe(true);
  expect(saved.get("n")).toBe(7);
  expect(never.get("n")).toBe(5);
  await ctx.storage.set("keel.store.m.other", "{not json");
  expect(await reread([other], read)).toBe(false);
  await ctx.storage.set("keel.store.m.other", JSON.stringify({ state: { n: "x" } }));
  expect(await reread([other], read)).toBe(false);
});
