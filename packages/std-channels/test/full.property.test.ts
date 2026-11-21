import { createCtx } from "@keel/ctx";
import fc from "fast-check";
import { expect, test } from "vitest";
import { ChannelsConfig } from "../src/server/ChannelsConfig.ts";
import type { Sink } from "../src/server/internal/Sink.ts";
import { full } from "../src/server/internal/full.ts";
import { hubOf } from "../src/server/internal/hubOf.ts";
import { join } from "../src/server/internal/join.ts";

const sink = (caller: string, module = "m"): Sink => ({
  key: "k",
  caller,
  module,
  post: () => undefined,
  saved: () => undefined,
});
const of = (sinks: Iterable<Sink>, module: string): Sink[] => [...sinks].filter((s) => s.module === module);
const count = (sinks: Iterable<Sink>, caller: string, module: string): number =>
  of(sinks, module).filter((s) => s.caller === caller).length;
const MODULES = ["m", "n"] as const;

const op = fc.oneof(
  fc.record({
    kind: fc.constant("open" as const),
    caller: fc.constantFrom("", "a", "b"),
    module: fc.constantFrom(...MODULES),
  }),
  fc.record({ kind: fc.constant("close" as const), at: fc.nat(), twice: fc.boolean() }),
);

test("for any opens and closes on two modules, each module's cookieless streams stay within its perAnonymous, each caller's within its perCaller, its streams within its maxStreams, and every count returns to zero", () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 1, max: 6 }),
      fc.integer({ min: 1, max: 6 }),
      fc.integer({ min: 1, max: 12 }),
      fc.array(op, { maxLength: 60 }),
      (perCaller, perAnonymous, maxStreams, ops) => {
        const ctx = createCtx({ mode: "sim", seed: 1337 });
        const hub = hubOf(ctx);
        const cfg = { perCaller, perAnonymous, maxStreams };
        const open: (() => void)[] = [];
        for (const o of ops) {
          if (o.kind === "open") {
            const before = count(hub.sinks, o.caller, o.module);
            const bound = o.caller === "" ? perAnonymous : perCaller;
            const admit = !full(hub.sinks, o.caller, o.module, cfg);
            expect(admit).toBe(of(hub.sinks, o.module).length < maxStreams && before < bound);
            if (admit) open.push(join(ctx, hub, sink(o.caller, o.module)));
          } else if (open.length > 0) {
            const [leave] = open.splice(o.at % open.length, 1);
            leave?.();
            if (o.twice) leave?.();
          }
          for (const m of MODULES) {
            expect(count(hub.sinks, "", m)).toBeLessThanOrEqual(perAnonymous);
            expect(count(hub.sinks, "a", m)).toBeLessThanOrEqual(perCaller);
            expect(count(hub.sinks, "b", m)).toBeLessThanOrEqual(perCaller);
            expect(of(hub.sinks, m).length).toBeLessThanOrEqual(maxStreams);
          }
          expect(hub.sinks.size).toBe(open.length);
        }
        for (const leave of open.splice(0)) {
          leave();
          leave();
        }
        expect(hub.sinks.size).toBe(0);
        expect(hub.stop).toBeUndefined();
      },
    ),
    { seed: 1337, numRuns: 200 },
  );
});

test("defaults: 64 cookieless streams, 8 per caller with a cookie, 1,000 in the process", () => {
  const anon = Array.from({ length: 64 }, () => sink(""));
  expect(full(anon.slice(0, 63), "", "m", {})).toBe(false);
  expect(full(anon, "", "m", {})).toBe(true);
  expect(full(anon, "a", "m", {})).toBe(false);
  const mine = Array.from({ length: 8 }, () => sink("a"));
  expect(full(mine.slice(0, 7), "a", "m", {})).toBe(false);
  expect(full(mine, "a", "m", {})).toBe(true);
  expect(full(mine, "", "m", {})).toBe(false);
  expect(
    full(
      Array.from({ length: 1000 }, (_, i) => sink(`c${i}`)),
      "z",
      "m",
      {},
    ),
  ).toBe(true);
});

test("another module's streams count against none of a module's bounds", () => {
  const other = [
    ...Array.from({ length: 1000 }, (_, i) => sink(`c${i}`, "n")),
    ...Array.from({ length: 64 }, () => sink("", "n")),
  ];
  expect(full(other, "", "m", {})).toBe(false);
  expect(full(other, "c1", "m", { perCaller: 1, maxStreams: 1 })).toBe(false);
  expect(full(other, "c1", "n", {})).toBe(true);
});

test("ChannelsConfig accepts perAnonymous as an integer of at least 1 and refuses 0, a fraction and an unknown key", () => {
  expect(ChannelsConfig.parse({ perAnonymous: 1 }).ok).toBe(true);
  expect(ChannelsConfig.parse({ perCaller: 2, perAnonymous: 64, maxStreams: 1000 }).ok).toBe(true);
  expect(ChannelsConfig.parse({ perAnonymous: 0 }).ok).toBe(false);
  expect(ChannelsConfig.parse({ perAnonymous: 1.5 }).ok).toBe(false);
  expect(ChannelsConfig.parse({ perAnon: 4 }).ok).toBe(false);
});
