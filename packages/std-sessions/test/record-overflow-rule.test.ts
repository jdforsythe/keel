// @vitest-environment happy-dom
// The recorder's overflow rule (std.sessions): past `limit` the buffer drops through its oldest `nav` and rebases
// there; with no `nav` buffered it rebases at its second input, keeping it and what followed; with neither it rebases
// now. The base's `at` and `state` are those of the place it rebased to.
// Seed 1337
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { type Step, play } from "../conformance/fixtures.ts";

const add: Step = { id: "cart.add" };
const wait: Step = { advance: 5 };
/** Add at 0, type the card at 5, navigate at 10, add at 15 and at 20. */
const withNav: readonly Step[] = [
  add,
  wait,
  { id: "cart.card", value: "42" },
  wait,
  { nav: true },
  wait,
  add,
  wait,
  add,
];
/** Add at 0, 5, 10 and 15. */
const adds: readonly Step[] = [add, wait, add, wait, add, wait, add];

async function kept(script: readonly Step[], limit?: number) {
  const { session } = await play(1337, script, limit === undefined ? {} : { limit });
  return {
    at: session.at,
    route: session.route.id,
    state: session.state,
    events: session.events.map((e) => {
      if (e.kind === "fire") return `${e.at} fire ${e.id}`;
      if (e.kind === "tx") return `${e.at} tx ${e.name}`;
      return `${e.at} ${e.kind}`;
    }),
  };
}
const cart = (items: number, card = "") => ({ cart: { items: Array.from({ length: items }, () => "a"), card } });
const click = (at: number): string[] => [`${at} fire cart.add`, `${at} tx cart.add`];

describe("record: the overflow rule", () => {
  test("within the limit nothing is cut: the base is where the recording began", async () => {
    expect(await kept(withNav)).toEqual({
      at: 0,
      route: "cart.show",
      state: cart(0),
      events: [...click(0), "5 fire cart.card", "5 tx cart.pay", "10 nav", ...click(15), ...click(20)],
    });
    expect(await kept(withNav, 9)).toEqual(await kept(withNav));
    expect(await kept(adds, 8)).toEqual({
      at: 0,
      route: "cart.show",
      state: cart(0),
      events: [0, 5, 10, 15].flatMap(click),
    });
  });

  test("past the limit the buffer drops through its oldest nav and the base is the page it reached", async () => {
    const afterNav = { at: 10, route: "cart.show", state: cart(1, "42"), events: [...click(15), ...click(20)] };
    for (const limit of [8, 7, 6, 5, 4]) expect(await kept(withNav, limit), `limit ${limit}`).toEqual(afterNav);
  });

  test("with no nav left it rebases at the second input, keeping it and what followed", async () => {
    expect(await kept(withNav, 3)).toEqual({ at: 20, route: "cart.show", state: cart(2, "42"), events: click(20) });
    expect(await kept(withNav, 2)).toEqual({ at: 20, route: "cart.show", state: cart(2, "42"), events: click(20) });
    expect(await kept(adds, 7)).toEqual({
      at: 5,
      route: "cart.show",
      state: cart(1),
      events: [5, 10, 15].flatMap(click),
    });
    expect(await kept(adds, 6)).toEqual({
      at: 5,
      route: "cart.show",
      state: cart(1),
      events: [5, 10, 15].flatMap(click),
    });
    expect(await kept(adds, 5)).toEqual({
      at: 10,
      route: "cart.show",
      state: cart(2),
      events: [10, 15].flatMap(click),
    });
    expect(await kept(adds, 4)).toEqual({
      at: 10,
      route: "cart.show",
      state: cart(2),
      events: [10, 15].flatMap(click),
    });
    expect(await kept(adds, 3)).toEqual({ at: 15, route: "cart.show", state: cart(3), events: click(15) });
    expect(await kept(adds, 2)).toEqual({ at: 15, route: "cart.show", state: cart(3), events: click(15) });
  });

  test("with neither it rebases now: a limit of 1 keeps an input until its transaction lands, then nothing", async () => {
    expect(await kept(adds, 1)).toEqual({ at: 15, route: "cart.show", state: cart(4), events: [] });
    expect(await kept(withNav, 1)).toEqual({ at: 20, route: "cart.show", state: cart(3, "42"), events: [] });
    expect(await kept([add], 1)).toEqual({ at: 0, route: "cart.show", state: cart(1), events: [] });
  });

  test("property: a session never holds more than `limit` events, and they are the newest ones", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 12 }), fc.integer({ min: 1, max: 8 }), async (limit, clicks) => {
        const script = Array.from({ length: clicks }, (): Step[] => [add, wait]).flat();
        const whole = await kept(script);
        const cut = await kept(script, limit);
        expect(cut.events.length).toBeLessThanOrEqual(limit);
        expect(cut.events).toEqual(whole.events.slice(whole.events.length - cut.events.length));
        if (whole.events.length <= limit) expect(cut).toEqual(whole);
      }),
      { seed: 1337, numRuns: 25 },
    );
  });
});
