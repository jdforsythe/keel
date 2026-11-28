// Seed 1337
// Spec: k.store, clause "An effect reading `stores()` reruns when a store is created and when its scope is disposed." (rfc:0070)
import { effect, scope } from "@keel/reactive";
import { store, stores } from "@keel/store";
import fc from "fast-check";
import { expect, test } from "vitest";
import { Cart } from "./fixtures";

test("an effect reading stores() reruns when a store is created and when its scope is disposed", () => {
  const seen: string[][] = [];
  const watcher = scope(() => effect(() => void seen.push([...stores().keys()].filter((k) => k.startsWith("rx.")))), {
    detached: true,
  });
  const owner = scope(
    () => {
      store(Cart, { items: [] }, { id: "rx.a" });
    },
    { detached: true },
  );
  expect(seen.at(-1)).toEqual(["rx.a"]);
  const runs = seen.length;
  owner.dispose();
  expect(seen.length).toBeGreaterThan(runs);
  expect(seen.at(-1)).toEqual([]);
  watcher.dispose();
});

test("for any sequence of creates and disposes, the effect's last read equals the live ids", () => {
  fc.assert(
    fc.property(fc.array(fc.boolean(), { maxLength: 12 }), (ops) => {
      const seen: string[][] = [];
      const watcher = scope(
        () => effect(() => void seen.push([...stores().keys()].filter((k) => k.startsWith("rp.")))),
        { detached: true },
      );
      const live: { id: string; sc: ReturnType<typeof scope> }[] = [];
      let n = 0;
      for (const create of ops) {
        if (create || live.length === 0) {
          const id = `rp.${n++}`;
          live.push({ id, sc: scope(() => void store(Cart, { items: [] }, { id }), { detached: true }) });
        } else live.shift()?.sc.dispose();
        expect(seen.at(-1)).toEqual(live.map((l) => l.id));
      }
      for (const l of live) l.sc.dispose();
      watcher.dispose();
    }),
    { seed: 1337, numRuns: 50 },
  );
});
