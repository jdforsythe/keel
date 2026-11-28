// Spec: std.statecharts, clause "`instance(c, 'a')` and `instance(c, 'b')` in one scope are stores `<id>:a` and `<id>:b`; a `tx` on one leaves the other unchanged; disposing the scope drops both from `stores()`; `instance(c, 'a b')` throws."
// Seed: 1337.
// Assumption: a throwing `instance` call surfaces as a thrown error from the call itself, inside or outside a scope.
import { scope } from "@keel/reactive";
import { instance } from "@keel/std-statecharts";
import { stores, tx } from "@keel/store";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { EVENTS, editor } from "./fixtures.ts";

describe("std.statecharts: instances compile the declaration again in the calling scope", () => {
  test("`instance(c, 'a')` and `instance(c, 'b')` in one scope are stores `<id>:a` and `<id>:b`", () => {
    const c = editor("inst");
    const sc = scope(
      () => {
        const a = instance(c, "a");
        const b = instance(c, "b");
        expect(a.store.id).toBe(`${c.store.id}:a`);
        expect(b.store.id).toBe(`${c.store.id}:b`);
        expect(stores().get(a.store.id)).toBe(a.store);
        expect(stores().get(b.store.id)).toBe(b.store);
        expect(a.store.schema.parse({ state: c.initial, data: { attempts: 0 } }).ok).toBe(true);
        expect(a.store.snapshot().state).toEqual(c.store.snapshot().state);
        expect([...a.store.payloads.keys()].sort()).toEqual(EVENTS.map((e) => `${a.store.id}.${e}`).sort());
      },
      { detached: true },
    );
    sc.dispose();
  });

  test("a `tx` on one instance leaves the other unchanged", () => {
    const c = editor("indep");
    fc.assert(
      fc.property(fc.array(fc.constantFrom(...EVENTS), { maxLength: 12 }), (events) => {
        const sc = scope(
          () => {
            const a = instance(c, "a");
            const b = instance(c, "b");
            const untouched = JSON.stringify(b.store.snapshot());
            for (const e of events) tx(a.events[e], {});
            expect(JSON.stringify(b.store.snapshot())).toBe(untouched);
            expect(JSON.stringify(c.store.snapshot().state)).toBe(
              JSON.stringify({ state: "viewing", data: { attempts: 0 } }),
            );
            tx(b.events.edit, {});
            expect(b.store.snapshot().state.state).toBe("editing");
          },
          { detached: true },
        );
        sc.dispose();
      }),
      { seed: 1337, numRuns: 50 },
    );
  });

  test("each instance runs the chart's function: `tx` of its event matches the chart's own store", () => {
    fc.assert(
      fc.property(fc.array(fc.constantFrom(...EVENTS), { maxLength: 12 }), (events) => {
        const ref = editor("ref");
        const sc = scope(
          () => {
            const a = instance(ref, "a");
            for (const e of events) {
              tx(ref.events[e], {});
              tx(a.events[e], {});
            }
            expect(a.store.snapshot().state).toEqual(ref.store.snapshot().state);
          },
          { detached: true },
        );
        sc.dispose();
      }),
      { seed: 1337, numRuns: 50 },
    );
  });

  test("disposing the scope drops both instances from `stores()`", () => {
    const c = editor("drop");
    let ids: string[] = [];
    const sc = scope(
      () => {
        const a = instance(c, "a");
        const b = instance(c, "b");
        ids = [a.store.id, b.store.id];
        expect(ids.every((id) => stores().has(id))).toBe(true);
      },
      { detached: true },
    );
    sc.dispose();
    expect(ids).toHaveLength(2);
    for (const id of ids) expect(stores().has(id)).toBe(false);
    expect(stores().has(c.store.id)).toBe(true);
  });

  test("`instance(c, 'a b')` throws", () => {
    const c = editor("badkey");
    const sc = scope(
      () => {
        expect(() => instance(c, "a b")).toThrow();
      },
      { detached: true },
    );
    sc.dispose();
  });

  test("a key of 1 to 64 characters of `[A-Za-z0-9._-]` is accepted, any other key throws", () => {
    const c = editor("keys");
    fc.assert(
      fc.property(fc.string({ maxLength: 80 }), (key) => {
        const valid = /^[A-Za-z0-9._-]{1,64}$/.test(key);
        const sc = scope(
          () => {
            if (valid) expect(instance(c, key).store.id).toBe(`${c.store.id}:${key}`);
            else expect(() => instance(c, key)).toThrow();
          },
          { detached: true },
        );
        sc.dispose();
      }),
      { seed: 1337, numRuns: 200 },
    );
  });

  test("a live duplicate `instance(c, 'a')` throws", () => {
    const c = editor("dup");
    const sc = scope(
      () => {
        instance(c, "a");
        expect(() => instance(c, "a")).toThrow();
      },
      { detached: true },
    );
    sc.dispose();
  });
});
