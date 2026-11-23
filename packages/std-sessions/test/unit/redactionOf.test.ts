// `redactionOf`: the redaction a recorder applies, subject by subject. A `tx:`, `store:` or `route:` entry replaces
// the value at its path, an `el:` entry masks an element's input, and every value an entry matched is scrubbed from
// later errors; `blind` is the fail-closed form of an error.
// Seed 1337
import { type JsonValue, s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { redactionOf } from "../../src/internal/redactionOf.ts";

const Pay = s.object({
  card: s.object({ number: s.string({ min: 12 }), holder: s.string() }),
  amount: s.int(),
  tags: s.array(s.string()),
  gift: s.boolean(),
});
const pay = {
  card: { number: "4242424242424242", holder: "Ada Lovelace" },
  amount: 424242,
  tags: ["alpha", "beta"],
  gift: true,
};
const failed = (message: string, data: JsonValue = null) => ({ code: "pay.failed", message, data });
type Fire = Parameters<ReturnType<typeof redactionOf>["fire"]>[0];
const input = (id: string, value: string): Fire => ({ at: 1, kind: "fire", id, event: { type: "input", value } });
const key = (id: string, k: string): Fire => ({ at: 1, kind: "fire", id, event: { type: "keydown", key: k } });

describe("redactionOf: tx and store entries", () => {
  test("a tx entry replaces the value at its path in that transaction's payload, and no other", () => {
    const r = redactionOf(["tx:cart.pay#card.number", "nonsense", "tx:cart.pay#amount", "tx:other#card.holder"], 7);
    const out = r.tx("cart.pay", Pay, pay);
    expect(out).toEqual({
      ...pay,
      card: { number: expect.stringMatching(/^[a-z]{12}$/), holder: "Ada Lovelace" },
      amount: 0,
    });
    expect(Pay.parse(out).ok).toBe(true);
    expect(r.tx("cart.add", Pay, pay)).toEqual(pay);
    expect(redactionOf([], 7).tx("cart.pay", Pay, pay)).toEqual(pay);
  });

  test("without a schema a tx payload is treated as JSON and a matched value is masked", () => {
    const r = redactionOf(["tx:cart.pay#card.number"], 7);
    expect(r.tx("cart.pay", undefined, pay)).toEqual({ ...pay, card: { ...pay.card, number: "x".repeat(16) } });
  });

  test("a store entry replaces the value at its path in that store's state", () => {
    const r = redactionOf(["store:cart#card.holder", "tx:cart#amount"], 7);
    const out = r.state("cart", Pay, pay);
    expect(out).toEqual({ ...pay, card: { number: pay.card.number, holder: expect.stringMatching(/^[a-z]{8}$/) } });
    expect(r.state("orders", Pay, pay)).toEqual(pay);
  });

  test("the generated value depends on the seed and on the subject", () => {
    const number = (v: JsonValue): unknown => {
      const parsed = Pay.parse(v);
      return parsed.ok ? parsed.value.card.number : undefined;
    };
    const entries = ["tx:cart.pay#card.number", "store:cart.pay#card.number"];
    expect(number(redactionOf(entries, 7).tx("cart.pay", Pay, pay))).toBe(
      number(redactionOf(entries, 7).tx("cart.pay", Pay, pay)),
    );
    expect(number(redactionOf(entries, 8).tx("cart.pay", Pay, pay))).not.toBe(
      number(redactionOf(entries, 7).tx("cart.pay", Pay, pay)),
    );
    expect(number(redactionOf(entries, 7).state("cart.pay", Pay, pay))).not.toBe(
      number(redactionOf(entries, 7).tx("cart.pay", Pay, pay)),
    );
  });

  test("a .pii() field is replaced with no entry at all", () => {
    const User = s.object({ email: s.string().pii("contact"), plan: s.string() });
    expect(redactionOf([], 7).state("user", User, { email: "ada@x.test", plan: "pro" })).toEqual({
      email: expect.stringMatching(/^[a-z]{8}$/),
      plan: "pro",
    });
  });
});

describe("redactionOf: what was matched is scrubbed from later errors", () => {
  test("a matched string, a matched number as text, and each string of a matched array", () => {
    const r = redactionOf(["tx:cart.pay#card.number", "tx:cart.pay#amount", "tx:cart.pay#tags", "tx:cart.pay#gift"], 7);
    r.tx("cart.pay", Pay, pay);
    expect(r.error(failed("card 4242424242424242 declined")).message).toBe(`card ${"x".repeat(16)} declined`);
    expect(r.error(failed("amount 424242 too high")).message).toBe("amount xxxxxx too high");
    expect(r.error(failed("tags alpha and beta")).message).toBe("tags xxxxx and xxxx");
    expect(r.error(failed("gift true, holder Ada Lovelace")).message).toBe("gift true, holder Ada Lovelace");
  });

  test("in data too: a string or a number that holds a matched value is masked, anything else keeps its value and type", () => {
    const r = redactionOf(["tx:cart.pay#card.number", "tx:cart.pay#amount"], 7);
    r.tx("cart.pay", Pay, pay);
    const data = { card: "no 4242424242424242", sum: 424242, other: 17, ok: true, none: null, list: ["424242", 3] };
    expect(r.error(failed("m", data)).data).toStrictEqual({
      card: `no ${"x".repeat(16)}`,
      sum: "xxxxxx",
      other: 17,
      ok: true,
      none: null,
      list: ["xxxxxx", 3],
    });
  });

  test("data.at is where the error fired and is never scrubbed", () => {
    const r = redactionOf(["el:pay.card#value"], 7);
    r.fire(input("pay.card", "pay.submit"));
    expect(r.error(failed("at pay.submit", { at: "pay.submit", near: "pay.submit" }))).toStrictEqual({
      code: "pay.failed",
      message: "at xxxxxxxxxx",
      data: { at: "pay.submit", near: "xxxxxxxxxx" },
    });
    expect(r.error(failed("m", { at: 5 })).data).toStrictEqual({ at: 5 });
    expect(r.error(failed("m", "pay.submit")).data).toBe("xxxxxxxxxx");
    expect(r.error(failed("m", ["pay.submit"])).data).toStrictEqual(["xxxxxxxxxx"]);
    expect(r.error(failed("m", { near: "pay.submit" })).data).toStrictEqual({ near: "xxxxxxxxxx" });
  });

  test("a value is found in any case, URL-encoded or JSON-escaped; a longer value is masked whole before a shorter one inside it", () => {
    const r = redactionOf([], 7);
    r.remember('Ada "L" Lovelace');
    expect(r.error(failed('holder ADA "l" lovelace')).message).toBe(`holder ${"x".repeat(16)}`);
    expect(r.error(failed("q=Ada%20%22L%22%20Lovelace")).message).toBe(`q=${"x".repeat(24)}`);
    expect(r.error(failed('{"holder":"Ada \\"L\\" Lovelace"}')).message).toBe(`{"holder":"${"x".repeat(18)}"}`);
    for (const order of [
      ["abc", "abcdef"],
      ["abcdef", "abc"],
    ]) {
      const nested = redactionOf([], 7);
      for (const v of order) nested.remember(v);
      expect(nested.error(failed("abcdef abc")).message, order.join()).toBe("xxxxxx xxx");
    }
  });

  test("a value with pattern characters is matched as text", () => {
    const r = redactionOf([], 7);
    r.remember("a.b*c");
    r.remember("(x)[y]{z}$^|\\+?");
    expect(r.error(failed("a.b*c axbbc (x)[y]{z}$^|\\+?")).message).toBe(`xxxxx axbbc ${"x".repeat(15)}`);
  });

  test("a value under 3 characters is masked only as a whole token; the empty string is never remembered", () => {
    const r = redactionOf([], 7);
    r.remember("ab");
    r.remember("");
    expect(r.error(failed("ab, cab abs ab7 7ab (ab) ab")).message).toBe("xx, cab abs ab7 7ab (xx) xx");
    const three = redactionOf([], 7);
    three.remember("abc");
    expect(three.error(failed("abc, cabcs")).message).toBe("xxx, cxxxs");
  });

  test("an error: entry masks its data path, data.at included when named, and the masked value is scrubbed from the message", () => {
    const r = redactionOf(["error:pay.failed#data.who", "error:pay.failed#data.at", "error:other#data.note"], 7);
    expect(r.error(failed("Ada could not pay", { who: "Ada", at: "pay.submit", note: "kept", n: 3 }))).toStrictEqual({
      code: "pay.failed",
      message: "xxx could not pay",
      data: { who: "xxx", at: "xxxxxxxxxx", note: "kept", n: 3 },
    });
    const none = redactionOf(["error:pay.failed#who"], 7);
    expect(none.error(failed("Ada could not pay", { who: "Ada" })).data).toStrictEqual({ who: "Ada" });
  });
});

describe("redactionOf: elements", () => {
  test("an el: entry on `value` masks that element's input values and one-character keys", () => {
    const r = redactionOf(["el:pay.card#value", "el:pay.note#label", "tx:pay.tx#value"], 7);
    expect(r.elements).toEqual(["pay.card"]);
    expect(r.fire(input("pay.card", "4242"))).toEqual(input("pay.card", "xxxx"));
    expect(r.fire(key("pay.card", "4"))).toEqual(key("pay.card", "x"));
    expect(r.fire(key("pay.card", "Enter"))).toEqual(key("pay.card", "Enter"));
    const click: Fire = { at: 1, kind: "fire", id: "pay.card", event: { type: "click" } };
    expect(r.fire(click)).toBe(click);
    const other = input("pay.note", "hello");
    expect(r.fire(other)).toBe(other);
    expect(r.fire(input("pay.tx", "hello"))).toEqual(input("pay.tx", "hello"));
    expect(r.error(failed("card 4242, note hello")).message).toBe("card xxxx, note hello");
  });

  test("an element whose input arrives masked stays masked: its later inputs and keys too", () => {
    const r = redactionOf([], 7);
    expect(r.elements).toEqual([]);
    expect(r.fire(key("login.password", "s"))).toEqual(key("login.password", "s"));
    expect(r.fire(input("login.password", "xxxxxx"))).toEqual(input("login.password", "xxxxxx"));
    expect(r.fire(key("login.password", "s"))).toEqual(key("login.password", "x"));
    expect(r.fire(input("login.password", "secret"))).toEqual(input("login.password", "xxxxxx"));
    expect(r.fire(input("login.name", "xxa"))).toEqual(input("login.name", "xxa"));
    expect(r.fire(input("login.name", "ada"))).toEqual(input("login.name", "ada"));
    expect(r.fire(input("login.empty", ""))).toEqual(input("login.empty", ""));
    expect(r.fire(input("login.empty", "typed"))).toEqual(input("login.empty", "typed"));
  });

  test("elements lists each element with a `value` entry, once", () => {
    const r = redactionOf(
      ["el:a#value", "el:b#other", "el:c#value", "el:a#value", "tx:d#value", "xel:e#value", "store:el:f#value"],
      7,
    );
    expect(r.elements).toEqual(["a", "c"]);
  });
});

describe("redactionOf: nav", () => {
  const Params = s.object({ itemId: s.string({ min: 4 }) });
  const Search = s.object({ q: s.string().optional(), token: s.secret(s.string()).optional() });
  const route = (params: Record<string, unknown>, search: Record<string, unknown>) =>
    ({
      kind: "nav",
      href: "/as/recorded",
      route: { id: "shop.item", path: "/items/:itemId", params, search, schemas: { params: Params, search: Search } },
    }) as const;

  test("a route entry replaces the param or search value it names and the href is rebuilt from the result", () => {
    const r = redactionOf(["route:shop.item#params.itemId", "route:shop.other#search.q"], 7);
    const out = r.nav(route({ itemId: "SECRET" }, { q: "shown" }));
    expect(out.route).toEqual({
      id: "shop.item",
      params: { itemId: expect.stringMatching(/^[a-z]{8}$/) },
      search: { q: "shown" },
    });
    expect(out.href).toBe(`/items/${String(out.route.params.itemId)}?q=shown`);
    const search = redactionOf(["route:shop.item#search.q"], 7).nav(route({ itemId: "open" }, { q: "hidden" }));
    expect(search.route.params).toEqual({ itemId: "open" });
    expect(search.route.search).toEqual({ q: expect.stringMatching(/^[a-z]{8}$/) });
    expect(search.href).toBe(`/items/open?q=${String(search.route.search.q)}`);
  });

  test("an entry for params does not reach a search key of the same name, nor the reverse", () => {
    const Both = s.object({ itemId: s.string().optional() });
    const event = {
      kind: "nav",
      href: "/x",
      route: {
        id: "shop.item",
        path: "/items/:itemId",
        params: { itemId: "PARAM" },
        search: { itemId: "SEARCH" },
        schemas: { params: Params, search: Both },
      },
    } as const;
    expect(redactionOf(["route:shop.item#params.itemId"], 7).nav(event).route.search).toEqual({ itemId: "SEARCH" });
    expect(redactionOf(["route:shop.item#search.itemId"], 7).nav(event).route.params).toEqual({ itemId: "PARAM" });
    expect(redactionOf(["route:shop.item#itemId"], 7).nav(event).route).toEqual({
      id: "shop.item",
      params: { itemId: "PARAM" },
      search: { itemId: "SEARCH" },
    });
  });

  test("a secret search value never stays in the href, with no entry at all", () => {
    const parsed = Search.parse({ q: "shown", token: "t0ken-value" });
    if (!parsed.ok) throw new Error("the fixture parses");
    const out = redactionOf([], 7).nav(route({ itemId: "open" }, parsed.value));
    expect(out.href).not.toContain("t0ken-value");
    expect(out.href).toBe(`/items/open?q=shown&token=${String(out.route.search.token)}`);
    expect(out.route.search.token).toMatch(/^[a-z]{8}$/);
  });

  test("a route with no schemas is redacted as JSON: a matched value is masked", () => {
    const event = {
      kind: "nav",
      href: "/x",
      route: { id: "shop.item", path: "/items/:itemId", params: { itemId: "SECRET" }, search: { n: 5 }, schemas: {} },
    } as const;
    const out = redactionOf(["route:shop.item#params.itemId", "route:shop.item#search.n"], 7).nav(event);
    expect(out).toEqual({
      route: { id: "shop.item", params: { itemId: "xxxxxx" }, search: { n: 0 } },
      href: "/items/xxxxxx?n=0",
    });
  });
});

describe("redactionOf: blind", () => {
  const r = redactionOf([], 7);

  test("the message becomes the code and every string or number of data is masked, but data.at", () => {
    expect(
      r.blind({
        code: "pay.failed",
        message: "Ada could not pay 42",
        data: { at: "pay.submit", who: "Ada", n: 42, ok: true, deep: [{ t: "x1" }, null] },
      }),
    ).toStrictEqual({
      code: "pay.failed",
      message: "pay.failed",
      data: { at: "pay.submit", who: "xxx", n: "xx", ok: true, deep: [{ t: "xx" }, null] },
    });
  });

  test("data that is no object, or has no string `at`, is masked through and through", () => {
    expect(r.blind(failed("m", "secret")).data).toBe("xxxxxx");
    expect(r.blind(failed("m", 1234)).data).toBe("xxxx");
    expect(r.blind(failed("m", null)).data).toBeNull();
    expect(r.blind(failed("m", ["a", "bc"])).data).toStrictEqual(["x", "xx"]);
    expect(r.blind(failed("m", { who: "Ada" })).data).toStrictEqual({ who: "xxx" });
    expect(r.blind(failed("m", { at: 5, who: "Ada" })).data).toStrictEqual({ at: "x", who: "xxx" });
    expect(r.blind(failed("m", { at: "", who: "" })).data).toStrictEqual({ at: "", who: "" });
  });

  test("property: no letter or digit of the message or of data outside `at` is left", () => {
    const word = fc.stringMatching(/^[A-Z0-9]{1,10}$/);
    fc.assert(
      fc.property(word, word, fc.array(word, { maxLength: 4 }), (message, who, list) => {
        const out = r.blind({ code: "c.d", message, data: { at: "c.d", who, list } });
        expect(out).toStrictEqual({
          code: "c.d",
          message: "c.d",
          data: { at: "c.d", who: "x".repeat(who.length), list: list.map((w) => "x".repeat(w.length)) },
        });
      }),
      { seed: 1337, numRuns: 100 },
    );
  });
});
