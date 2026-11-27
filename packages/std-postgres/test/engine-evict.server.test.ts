// Seed 1337. std.postgres Modes: at most two pglite: folders stay open in a process; opening another closes the idle
// ones used least recently, never a busy one or a postgres: pool, and the use order carries over a reload of the module.
import { rmSync } from "node:fs";
import { join } from "node:path";
import { testTime } from "@keel/tooling/test-time";
import { tempDir } from "@keel/tooling/test-tmp";
import { afterAll, expect, test, vi } from "vitest";

const KEY = Symbol.for("keel.postgres.engines");
const dir = tempDir("keel-evict-");
const before: unknown = Reflect.get(globalThis, KEY);

const fresh = async (): Promise<typeof import("../src/server/internal/engineFor.server.ts")> => {
  vi.resetModules();
  return import("../src/server/internal/engineFor.server.ts");
};

/** Closes every engine the shared map holds, then puts the map that was there back. */
afterAll(async () => {
  const shared: unknown = Reflect.get(globalThis, KEY);
  if (shared instanceof Map)
    for (const o of shared.values()) {
      const close: unknown = Reflect.get(Object(o), "close");
      if (typeof close === "function") await Reflect.apply(close, o, []);
    }
  Reflect.set(globalThis, KEY, before);
  rmSync(dir, { recursive: true, force: true });
});

test("the least recently used idle folders close first; a busy folder and a postgres: pool stay open", async () => {
  const closed: string[] = [];
  const entry = (name: string, used: number, busy = 0) => ({
    engine: Promise.resolve(null),
    busy,
    used,
    close: async () => {
      closed.push(name);
    },
  });
  Reflect.set(
    globalThis,
    KEY,
    new Map([
      ["postgres://u:p@127.0.0.1:1/x", entry("pool", 1)],
      ["pglite:/keel-evict-busy", entry("busy", 2, 1)],
      ["pglite:/keel-evict-b", entry("b", 1000)],
      ["pglite:/keel-evict-a", entry("a", 500)],
    ]),
  );
  const { engineFor } = await fresh();
  const one = await engineFor(`pglite:${join(dir, "one")}`);
  expect(closed).toEqual(["a"]);
  const two = await engineFor(`pglite:${join(dir, "two")}`);
  expect(closed).toEqual(["a", "b"]);
  const shared: unknown = Reflect.get(globalThis, KEY);
  expect(shared instanceof Map ? [...shared.keys()].sort() : []).toEqual(
    [
      "postgres://u:p@127.0.0.1:1/x",
      "pglite:/keel-evict-busy",
      `pglite:${join(dir, "one")}`,
      `pglite:${join(dir, "two")}`,
    ].sort(),
  );
  expect((await one.statement("select 1 as v", [])).rows).toEqual([["1"]]);
  expect((await two.statement("select 2 as v", [])).rows).toEqual([["2"]]);
});

test("a folder evicted while it opens is closed once open, and opening it again gives a working engine", async () => {
  Reflect.set(globalThis, KEY, new Map());
  const { engineFor } = await fresh();
  const urls = ["p", "q", "r"].map((n) => `pglite:${join(dir, n)}`);
  const [p, q, r] = urls.map((u) => engineFor(u));
  const first = await p;
  await Promise.all([q, r]);
  await expect(first?.statement("select 1", [])).rejects.toThrow();
  const again = await engineFor(urls[0] ?? "");
  expect(again).not.toBe(first);
  expect((await again.statement("select 3 as v", [])).rows).toEqual([["3"]]);
  const shared: unknown = Reflect.get(globalThis, KEY);
  expect(shared instanceof Map ? [...shared.keys()].sort() : []).toEqual([urls[0], urls[2]].sort());
});

test("an open folder that is evicted closes its PGlite", async () => {
  Reflect.set(globalThis, KEY, new Map());
  const { engineFor } = await fresh();
  const [x, y, z] = ["x", "y", "z"].map((n) => `pglite:${join(dir, n)}`);
  const ex = await engineFor(x ?? "");
  await engineFor(y ?? "");
  await engineFor(z ?? "");
  await vi.waitFor(async () => expect(ex.statement("select 1", [])).rejects.toThrow(), { timeout: testTime(10_000) });
});
