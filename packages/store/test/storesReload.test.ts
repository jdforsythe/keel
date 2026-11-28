// `@keel/store/internal` `storesReload` (k.data Dev): a `keel dev` reload carries the module registry's ids over, so a
// module evaluated again creates its store in place of the earlier load's. fast-check seed 1337.
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { isolate, store, stores } from "../src/index.ts";
import { storesReload } from "../src/internal/index.ts";

const make = (id: string) => store(s.object({ n: s.int() }), { n: 0 }, { id });

describe("storesReload", () => {
  it("lets a carried id be created once more, listing the new store, and a second creation still throws", () => {
    const earlier = scope(() => undefined);
    const old = earlier.run(() => make("reload.one"));
    storesReload();
    const later = scope(() => undefined);
    const fresh = later.run(() => make("reload.one"));
    expect(fresh).not.toBe(old);
    expect(later.run(() => stores().get("reload.one"))).toBe(fresh);
    expect(() => scope(() => make("reload.one"))).toThrow("store reload.one: id already in use by a live store");
    // The earlier load's scope ending leaves the new store registered.
    earlier.dispose();
    expect(later.run(() => stores().get("reload.one"))).toBe(fresh);
    later.dispose();
  });

  it("carries only ids live at the call, and nothing of an isolated scope's registry", () => {
    const own = scope(() => undefined);
    isolate(own);
    own.run(() => make("reload.own"));
    storesReload();
    const outside = scope(() => make("reload.own"));
    expect(() => own.run(() => make("reload.own"))).toThrow(/already in use/);
    const late = scope(() => make("reload.late"));
    expect(() => scope(() => make("reload.late"))).toThrow(/already in use/);
    for (const sc of [own, outside, late]) sc.dispose();
  });

  it("property: after a reload, each carried id is taken over exactly once", () => {
    fc.assert(
      fc.property(fc.uniqueArray(fc.stringMatching(/^[a-z]{1,6}$/), { minLength: 1, maxLength: 5 }), (names) => {
        const ids = names.map((n) => `prop.${n}`);
        const first = scope(() => {
          for (const id of ids) make(id);
        });
        storesReload();
        const second = scope(() => {
          for (const id of ids) make(id);
        });
        for (const id of ids) expect(() => scope(() => make(id))).toThrow(/already in use/);
        first.dispose();
        second.dispose();
        storesReload();
      }),
      { seed: 1337 },
    );
  });
});
