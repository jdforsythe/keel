import { fixedTime } from "@keel/tooling/test-time";
// @vitest-environment happy-dom
// `replay` on the cart fixture, event by event: the replay's own recording equals the session it replays (same
// events at the same times, an input's effect not applied twice), what `observed` holds, the base it starts from,
// and what stops it: a base route the table lacks, an element that is gone, an href that matches nothing.
// Seed 1337
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { type Step, cartRoutes, play, stepArb } from "../../conformance/fixtures.ts";
import type { Session } from "../../src/Session.schema.ts";
import { replayRun } from "../../src/internal/replayRun.ts";
import { replay } from "../../src/replay.ts";

const add: Step = { id: "cart.add" };
const card = (value: string): Step => ({ id: "cart.card", value });
const script: readonly Step[] = [
  add,
  { advance: 5 },
  card("42"),
  { advance: 7 },
  { nav: true },
  { advance: 3 },
  { id: "cart.reload" },
  add,
];
const routes = () => cartRoutes();
const kinds = (s: { events: readonly { kind: string }[] }): string[] => s.events.map((e) => e.kind);

describe("replay: what it reproduces", () => {
  test("the replay records the very events of the session, at their times, and ends in the live app's state", async () => {
    const { session, live } = await play(1337, script);
    expect(kinds(session)).toEqual(["fire", "tx", "fire", "tx", "nav", "fire", "nav", "fire", "tx"]);
    const { result, recorded } = await replayRun(session, { routes: routes() });
    expect(recorded.events).toEqual(session.events);
    expect(recorded).toMatchObject({
      at: session.at,
      route: session.route,
      state: session.state,
      fingerprint: session.fingerprint,
    });
    expect(result).toEqual({
      observed: session.events.filter((e) => e.kind === "tx"),
      state: live,
      error: null,
      reproduced: true,
      unapplied: null,
    });
    expect(await replay(session, { routes: routes() })).toEqual(result);
  });

  test("a click that navigates is applied once: the nav it caused is passed over, not replayed as a second one", async () => {
    const { session } = await play(1337, [{ id: "cart.reload" }, { id: "cart.reload" }, add]);
    expect(kinds(session)).toEqual(["fire", "nav", "fire", "nav", "fire", "tx"]);
    const { recorded, result } = await replayRun(session, { routes: routes() });
    expect(recorded.events).toEqual(session.events);
    expect(result.unapplied).toBeNull();
  });

  test("two inputs that differ only in their value are two inputs", async () => {
    const { session, live } = await play(1337, [card("a"), card("b"), card("a")]);
    const { recorded, result } = await replayRun(session, { routes: routes() });
    expect(recorded.events).toEqual(session.events);
    expect(result.state).toEqual(live);
    expect(result.state).toEqual({ cart: { items: [], card: "a" } });
  });

  test("the same input twice in a row is applied twice", async () => {
    const { session } = await play(1337, [add, add, add]);
    const { result } = await replayRun(session, { routes: routes() });
    expect(result.state).toEqual({ cart: { items: ["a", "a", "a"], card: "" } });
    expect(result.observed).toHaveLength(3);
  });

  test("a session shifted to start at 100 replays with every event 100 later", async () => {
    const { session } = await play(1337, script);
    const later: Session = { ...session, at: 100, events: session.events.map((e) => ({ ...e, at: e.at + 100 })) };
    const { recorded, result } = await replayRun(later, { routes: routes() });
    expect(recorded.at).toBe(100);
    expect(recorded.events).toEqual(later.events);
    expect(result.reproduced).toBe(true);
  });

  test("events whose time goes backwards do not move the clock back", async () => {
    const { session } = await play(1337, [add, { advance: 10 }, add]);
    const swapped: Session = { ...session, events: session.events.map((e) => ({ ...e, at: e.at === 10 ? 4 : 10 })) };
    const { recorded } = await replayRun(swapped, { routes: routes() });
    expect(recorded.events.map((e) => e.at)).toEqual([10, 10, 10, 10]);
  });

  // What the case bounds: 520 events recorded and the 520 replayed, about 0.4 ms an event here beside other work. The
  // bound is 10 ms an event, so a runner ten times slower (scale 0.1) still has 1 ms an event.
  test(
    "more than 500 events are all replayed and observed",
    async () => {
      const { session } = await play(
        1337,
        Array.from({ length: 260 }, () => add),
        { limit: 2000 },
      );
      expect(session.events).toHaveLength(520);
      const result = await replay(session, { routes: routes() });
      expect(result.observed).toHaveLength(260);
      expect(result.reproduced).toBe(true);
    },
    fixedTime(2 * 520 * 10),
  );

  test("the base state is the session's: a store it names starts there, and the replay puts the store back after", async () => {
    const { session } = await play(1337, [add]);
    const seeded: Session = { ...session, state: { cart: { items: ["seeded"], card: "kept" } } };
    const result = await replay(seeded, { routes: routes() });
    expect(result.state).toEqual({ cart: { items: ["seeded", "a"], card: "kept" } });
    const fresh = await replay({ ...session, state: {} }, { routes: routes() });
    expect(fresh.state).toEqual({ cart: { items: ["a"], card: "" } });
  });

  test("`observed` holds what the replay recorded that is no fire and no nav: transactions and net changes", async () => {
    const { session } = await play(1337, [add, { nav: true }]);
    const offline: Session = {
      ...session,
      events: [...session.events, { at: 0, kind: "net", online: false }, { at: 0, kind: "net", online: true }],
    };
    const result = await replay(offline, { routes: routes() });
    expect(result.observed).toEqual([
      { at: 0, kind: "tx", store: "cart", name: "cart.add", payload: { sku: "a" } },
      { at: 0, kind: "net", online: false },
      { at: 0, kind: "net", online: true },
    ]);
    expect(result.unapplied).toBeNull();
  });

  test("with the recording's redact entries the replay redacts as the recording did", async () => {
    const redact = ["tx:cart.pay#card.number"];
    const { session } = await play(1337, [card("4242424242424242")], { redact });
    expect(JSON.stringify(session.events.filter((e) => e.kind === "tx"))).not.toContain("4242424242424242");
    const { recorded } = await replayRun(session, { routes: routes(), redact });
    expect(recorded.events.filter((e) => e.kind === "tx")).toEqual(session.events.filter((e) => e.kind === "tx"));
    const bare = await replayRun(session, { routes: routes() });
    expect(bare.recorded.events.filter((e) => e.kind === "tx")).not.toEqual(
      session.events.filter((e) => e.kind === "tx"),
    );
    const none = await replayRun(session, { routes: routes(), redact: [] });
    expect(none.recorded.events).toEqual(bare.recorded.events);
  });
});

describe("replay: what stops it", () => {
  test("a base route the table lacks: -1, nothing applied, not reproduced", async () => {
    const { session } = await play(1337, [add]);
    const result = await replay(
      { ...session, route: { id: "cart.gone", params: {}, search: {} } },
      { routes: routes() },
    );
    expect(result).toMatchObject({ unapplied: -1, observed: [], error: null, reproduced: false });
    expect(result.state).toHaveProperty("cart");
  });

  test("a fire on an element that is not there stops at its index with E2003; what came before was applied", async () => {
    const { session } = await play(1337, [add, add]);
    const gone = { at: 0, kind: "fire" as const, id: "cart.gone", event: { type: "click" as const } };
    const events = [...session.events.slice(0, 2), gone, ...session.events.slice(2)];
    const { result, recorded } = await replayRun({ ...session, events }, { routes: routes() });
    expect(result.unapplied).toBe(2);
    expect(result.reproduced).toBe(false);
    expect(result.error).toEqual({ code: "E2003", message: "cannot apply input 2", data: { at: "sessions.replay" } });
    expect(result.state).toEqual({ cart: { items: ["a"], card: "" } });
    expect(kinds(recorded)).toEqual(["fire", "tx", "error"]);
    expect(result.observed.map((e) => e.kind)).toEqual(["tx", "error"]);
  });

  test("a nav whose href matches no route stops there too", async () => {
    const { session } = await play(1337, [add]);
    const events = [{ at: 0, kind: "nav" as const, href: "/nowhere" }, ...session.events];
    const result = await replay({ ...session, events }, { routes: routes() });
    expect(result.unapplied).toBe(0);
    expect(result.error?.code).toBe("E2003");
    expect(result.error?.message).toBe("cannot apply input 0");
    expect(result.state).toEqual({ cart: { items: [], card: "" } });
    const fine = await replay(
      { ...session, events: [{ at: 0, kind: "nav" as const, href: "/cart" }, ...session.events] },
      { routes: routes() },
    );
    expect(fine.unapplied).toBeNull();
  });

  test("a session with another fingerprint replays whole and is reported not reproduced", async () => {
    const { session, live } = await play(1337, [add]);
    const result = await replay({ ...session, fingerprint: "000000000000" }, { routes: routes() });
    expect(result).toMatchObject({ reproduced: false, unapplied: null, error: null, state: live });
  });
});

describe("replay: property", () => {
  test("any script replays to the events it recorded and the state it ended in", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(stepArb, { maxLength: 12 }), async (steps) => {
        const { session, live } = await play(1337, steps);
        const { result, recorded } = await replayRun(session, { routes: routes() });
        expect(recorded.events).toEqual(session.events);
        expect(result.state).toEqual(live);
        expect(result.reproduced).toBe(true);
        expect(result.unapplied).toBeNull();
      }),
      { seed: 1337, numRuns: 25 },
    );
  });
});
