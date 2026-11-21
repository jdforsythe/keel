// Spec: std.statecharts, Conformance "The compiled store's schema parses `{ state: initial, data: start }` and refuses a state name outside `states`; each event's transaction is named `<id>.<event>` and its `schema` is that event's payload schema."
// Seed: 1337.
// Assumption: a transaction's name is observable as the key of `store.payloads` and as the `name` of its log entry.
// `chart.states` is not asserted beyond the names the fixture declares: the spec does not give its shape.
import { s } from "@keel/schema";
import { chart } from "@keel/std-statecharts";
import { tx } from "@keel/store";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { EVENTS, STATES, editor, nextId } from "./fixtures.ts";

describe("std.statecharts: compiles to a store and one transaction per event", () => {
  test("The compiled store's schema parses `{ state: initial, data: start }`", () => {
    const c = editor();
    expect(c.initial).toBe("viewing");
    expect(c.store.schema.parse({ state: c.initial, data: { attempts: 0 } }).ok).toBe(true);
    expect(c.store.snapshot().state).toEqual({ state: "viewing", data: { attempts: 0 } });
  });

  test("the store's schema refuses a state name outside `states`", () => {
    const c = editor();
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-zA-Z]{1,12}$/).filter((n) => !STATES.some((st) => st === n)),
        fc.integer({ min: 0, max: 3 }),
        (name, attempts) => {
          expect(c.store.schema.parse({ state: name, data: { attempts } }).ok).toBe(false);
        },
      ),
      { seed: 1337, numRuns: 100 },
    );
    for (const name of STATES) expect(c.store.schema.parse({ state: name, data: { attempts: 0 } }).ok).toBe(true);
    // closed: true
    expect(c.store.schema.parse({ state: "viewing", data: { attempts: 0 }, extra: 1 }).ok).toBe(false);
  });

  test("each event's transaction is named `<id>.<event>`", async () => {
    const c = editor("named");
    expect(Object.keys(c.events).sort()).toEqual([...EVENTS].sort());
    expect([...c.store.payloads.keys()].sort()).toEqual(EVENTS.map((e) => `${c.store.id}.${e}`).sort());
    await tx(c.events.edit, {});
    expect(c.store.log().map((e) => e.name)).toEqual([`${c.store.id}.edit`]);
  });

  test("each event's transaction `schema` is that event's payload schema", () => {
    const Bump = s.object({ by: s.int({ min: 0, max: 3 }) });
    const Name = s.object({ label: s.string({ min: 1 }) });
    const c = chart(nextId("schemas"), {
      data: s.object({ n: s.int({ min: 0, max: 3 }) }),
      start: { n: 0 },
      events: { bump: Bump, rename: Name, stop: s.object({}) },
      initial: "on",
      states: { on: { on: { bump: "on", rename: "on", stop: "off" } }, off: { final: true } },
    });
    expect(Object.keys(c.events).sort()).toEqual(["bump", "rename", "stop"]);
    const values = fc.oneof(
      fc.record({ by: fc.integer({ min: -2, max: 6 }) }),
      fc.record({ label: fc.string({ maxLength: 4 }) }),
      fc.constant({}),
      fc.anything(),
    );
    fc.assert(
      fc.property(values, (v) => {
        expect(c.events.bump.schema.parse(v).ok).toBe(Bump.parse(v).ok);
        expect(c.events.rename.schema.parse(v).ok).toBe(Name.parse(v).ok);
      }),
      { seed: 1337, numRuns: 100 },
    );
  });
});
