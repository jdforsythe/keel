// `@keel/store/internal` `storesReload`, `storesFile`, `storesLoaded` (k.data Dev, k.store Ids and invariants): a
// `keel dev` load lets a store take a carried id only at the file whose store held it, once, and ends by removing
// what no store took and disposing the scopes of the stores that left. fast-check seed 1337.
import { type Scope, effect, scope, signal } from "@keel/reactive";
import { s } from "@keel/schema";
import * as fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";
import { isolate, store, stores } from "../src/index.ts";
import { devLoad } from "../src/internal/devLoad.ts";
import { storesFile, storesLoaded, storesReload } from "../src/internal/index.ts";
import type { Store } from "../src/types/Store.ts";

const S = s.object({ n: s.int() });
/** A root scope, as a test makes one: `scope` with no owner and no `detached` is E1208. */
const detachedScope = (fn: () => void): Scope => scope(fn, { detached: true });
const made: Scope[] = [];
/** A store of `id` in a scope of its own, as the compiler gives a module-level store. */
const make = (id: string): Store<{ n: number }> => {
  let st: Store<{ n: number }> | undefined;
  made.push(
    detachedScope(() => {
      st = store(S, { n: 0 }, { id });
    }),
  );
  if (st === undefined) throw new Error("no store");
  return st;
};
const ids = (): string[] => [...stores().keys()].sort();

afterEach(() => {
  storesLoaded();
  for (const sc of made.splice(0)) sc.dispose();
  devLoad.armed = false;
  devLoad.file = undefined;
});

describe("storesFile before any storesReload", () => {
  it("records nothing: a duplicate live id throws whatever file is named", () => {
    storesFile("a.ts");
    make("pre.x");
    expect(() => make("pre.x")).toThrow("store pre.x: id already in use by a live store");
    // Not recorded, so a later load cannot take it at `a.ts` either.
    storesReload();
    storesFile("a.ts");
    expect(() => make("pre.x")).toThrow(/already in use/);
  });
});

describe("a dev load of the module registry", () => {
  it("lets a store at the holder's file take the id once, and a second creation in the load throws", () => {
    storesReload();
    storesFile("a.ts");
    const old = make("one.x");
    storesLoaded();
    storesReload();
    storesFile("a.ts");
    const fresh = make("one.x");
    expect(fresh).not.toBe(old);
    expect(stores().get("one.x")).toBe(fresh);
    expect(() => make("one.x")).toThrow("store one.x: id already in use by a live store");
  });

  it("refuses a store at another file, which leaves the id for the holder's file", () => {
    storesReload();
    storesFile("a.ts");
    const old = make("two.x");
    storesLoaded();
    storesReload();
    storesFile("b.ts");
    expect(() => make("two.x")).toThrow("store two.x: id already in use by a live store");
    expect(stores().get("two.x")).toBe(old);
    storesFile("a.ts");
    expect(make("two.x")).not.toBe(old);
  });

  it("matches a store created at no file only to a store created at no file", () => {
    storesReload();
    make("none.x");
    storesLoaded();
    storesReload();
    storesFile("a.ts");
    expect(() => make("none.x")).toThrow(/already in use/);
    storesLoaded();
    storesReload();
    expect(make("none.x").id).toBe("none.x");
  });

  it("forgets the file at storesReload and at storesLoaded", () => {
    storesReload();
    storesFile("a.ts");
    make("forget.x");
    storesReload();
    // No file named since this load started: not `a.ts`.
    expect(() => make("forget.x")).toThrow(/already in use/);
    storesLoaded();
    make("forget.y");
    storesReload();
    storesFile("a.ts");
    // `forget.y` was made after the load ended, at no file.
    expect(() => make("forget.y")).toThrow(/already in use/);
  });

  it("never takes an id first created in this load", () => {
    storesReload();
    storesFile("a.ts");
    make("new.x");
    expect(() => make("new.x")).toThrow(/already in use/);
  });

  it("empties the carried set and forgets the file at the load's end", () => {
    storesReload();
    storesFile("a.ts");
    make("clear.x");
    storesReload();
    expect(devLoad.carried.size).toBeGreaterThan(0);
    storesLoaded();
    expect(devLoad.carried.size).toBe(0);
    expect(devLoad.file).toBeUndefined();
  });

  it("removes at the load's end each carried id no store took, rerunning stores() readers once", () => {
    storesReload();
    storesFile("a.ts");
    make("gone.x");
    make("gone.kept");
    storesLoaded();
    storesReload();
    storesFile("a.ts");
    make("gone.kept");
    let runs = 0;
    const watch = detachedScope(() => {
      effect(() => {
        stores();
        runs++;
      });
    });
    made.push(watch);
    expect(ids()).toContain("gone.x");
    const before = runs;
    storesLoaded();
    expect(ids()).not.toContain("gone.x");
    expect(ids()).toContain("gone.kept");
    expect(runs).toBe(before + 1);
    // Ended: a store of the id is new again, and its duplicate throws.
    storesFile("b.ts");
    make("gone.x");
    expect(() => make("gone.x")).toThrow(/already in use/);
  });

  it("fires no stores() reader when no id left", () => {
    storesReload();
    storesFile("a.ts");
    make("still.x");
    storesLoaded();
    storesReload();
    storesFile("a.ts");
    make("still.x");
    let runs = 0;
    made.push(
      detachedScope(() => {
        effect(() => {
          stores();
          runs++;
        });
      }),
    );
    const before = runs;
    storesLoaded();
    expect(runs).toBe(before);
  });

  it("disposes the owning scope of a store that left and of one taken over, not of one still live", () => {
    const root = detachedScope(() => undefined);
    made.push(root);
    const tick = root.run(() => signal(0));
    const seen: string[] = [];
    const at = (id: string, label: string): Scope => {
      const sc = detachedScope(() => {
        store(S, { n: 0 }, { id });
        effect(() => {
          tick.get();
          seen.push(label);
        });
      });
      made.push(sc);
      return sc;
    };
    storesReload();
    storesFile("a.ts");
    at("scope.left", "left");
    at("scope.taken", "taken-old");
    storesLoaded();
    storesReload();
    storesFile("a.ts");
    at("scope.taken", "taken-new");
    seen.length = 0;
    tick.set(1);
    // Until the load ends, the earlier load's stores still run.
    expect(seen.sort()).toEqual(["left", "taken-new", "taken-old"]);
    storesLoaded();
    seen.length = 0;
    tick.set(2);
    expect(seen).toEqual(["taken-new"]);
  });

  it("keeps a scope that a store still in the registry owns", () => {
    const shared = detachedScope(() => undefined);
    made.push(shared);
    storesReload();
    storesFile("a.ts");
    shared.run(() => store(S, { n: 0 }, { id: "share.gone" }));
    storesLoaded();
    storesReload();
    storesFile("a.ts");
    shared.run(() => store(S, { n: 0 }, { id: "share.new" }));
    storesLoaded();
    expect(ids()).not.toContain("share.gone");
    expect(ids()).toContain("share.new");
    // A disposed scope refuses `run` (E1206).
    expect(shared.run(() => 1)).toBe(1);
  });

  it("leaves an isolated scope's registry alone", () => {
    const own = detachedScope(() => undefined);
    isolate(own);
    made.push(own);
    storesReload();
    storesFile("a.ts");
    own.run(() => store(S, { n: 0 }, { id: "iso.y" }));
    storesLoaded();
    storesReload();
    storesFile("a.ts");
    expect(() => own.run(() => store(S, { n: 0 }, { id: "iso.y" }))).toThrow(/already in use/);
    storesLoaded();
    expect(own.run(() => [...stores().keys()])).toEqual(["iso.y"]);
    expect(ids()).not.toContain("iso.y");
  });
});

/** One load: the stores it creates, each `[id, file]`, `file` undefined for none named. */
type Load = readonly (readonly [string, string | undefined])[];

describe("property: the registry laws of a dev load", () => {
  it("each creation throws exactly when its id is live and not a carried id held at its file, and each load ends with the ids a model gives", () => {
    const load = fc.array(
      fc.tuple(fc.constantFrom("p.a", "p.b", "p.c"), fc.constantFrom<string | undefined>("a.ts", "b.ts", undefined)),
      { maxLength: 6 },
    );
    fc.assert(
      fc.property(fc.array(load, { minLength: 1, maxLength: 5 }), (loads: readonly Load[]) => {
        // The model: each live id's file; the carried ids and their files at the load's start.
        let live = new Map<string, string | undefined>();
        for (const l of loads) {
          const carried = new Map(live);
          const next = new Map(live);
          const took = new Set<string>();
          storesReload();
          for (const [id, file] of l) {
            if (file === undefined) devLoad.file = undefined;
            else storesFile(file);
            const takes = next.has(id) && carried.has(id) && !took.has(id) && carried.get(id) === file;
            if (next.has(id) && !takes)
              expect(() => make(id)).toThrow(`store ${id}: id already in use by a live store`);
            else {
              make(id);
              next.set(id, file);
              if (takes) took.add(id);
              carried.delete(id);
            }
          }
          storesLoaded();
          for (const id of carried.keys()) if (!took.has(id)) next.delete(id);
          live = next;
          expect(ids().filter((i) => i.startsWith("p."))).toEqual([...live.keys()].sort());
        }
        for (const sc of made.splice(0)) sc.dispose();
        storesReload();
        storesLoaded();
      }),
      { seed: 1337, numRuns: 200 },
    );
  });
});
