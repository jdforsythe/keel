// @vitest-environment happy-dom
// Spec: k.identity, clause "With `a = action(c, 'p.b', { input: A }, run)` and `A`, `B` object schemas: `Object.isFrozen(a)` is true, and `manifest` given `{ ...a }`, `{ ...a, input: B }`, `Object.assign(Object.create(Object.getPrototypeOf(a)), a)`, an object given every `Reflect.ownKeys(a)` key with its descriptor, or `new Proxy(a, {})` in `a`'s place throws a value whose message starts `E1515` and names `p.b`, and runs nothing; the same holds of a `loader`'s and a `guard`'s copies."
// Spec: k.identity, clause "`isSchema(S)`, `isStore(st)`, `isTransaction(tx)` and `isRouteTable(routes)` are true of what `s.object`, `store`, `transaction` and `manifest` returned, also under a second copy of the guard's package loaded from another path; each is false of `{ ...v }`, of an object given every own key and descriptor of `v`, and of a function or object declaring `Symbol.for('keel.schema')`, `Symbol.for('keel.store')` or `Symbol.for('keel.action')` as an own key."
// Spec: k.identity, clause "A made value is frozen. A copy is not that thing: a spread, `Object.assign`, `structuredClone`, a `Proxy` over it, and an object given each of its own keys and descriptors, symbol keys among them, fail every guard." (a bullet of k.identity's prose list)
// Spec: k.identity, clause "Where the kernel binds a handler (`manifest`, `createApp`, `createRouter`), a value no maker made is E1515, naming the route id and the member; nothing runs it." (a bullet of k.identity's prose list)
// Seed 1337. The store, transaction and schema guards are asserted in packages/store and packages/schema; here only the router's `isRouteTable`.
// A copy that cannot be made (`structuredClone` of a function, a JSON round trip of one) is itself "not that thing"; one that can is refused.
// The calls are untyped (Reflect.apply) because a forged value does not type-check.
import { guard, isRouteTable, loader, manifest, action } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it, vi } from "vitest";
import { SEED, thrown } from "./contract-support.ts";

const A = s.object({ a: s.string() });
const B = s.object({ b: s.string() });
const c = contract("p", {
  "p.b": { path: "/b" },
  "p.l": { path: "/l" },
  "p.g": { path: "/g" },
});
const view = () => document.createElement("main");
const ran = { n: 0 };
const act = action(c, "p.b", { input: A }, async () => {
  ran.n += 1;
  return ok(null);
});
const load = loader(c, "p.l", { output: A }, async () => {
  ran.n += 1;
  return ok({ a: "x" });
});
const gate = guard({ redirect: "p.b" }, async () => {
  ran.n += 1;
  return ok(null);
});

type Kind = "action" | "loader" | "guard";
const MADE: Record<Kind, { value: object; id: string; member: string; other: Record<string, unknown> }> = {
  action: { value: act, id: "p.b", member: "POST", other: { input: B } },
  loader: { value: load, id: "p.l", member: "loader", other: { output: B } },
  guard: { value: gate, id: "p.g", member: "guard", other: { redirect: "p.l" } },
};
const bindWith = (kind: Kind, handler: unknown): Record<string, unknown> => {
  const b: Record<string, unknown> = {
    "p.b": { component: view, POST: kind === "action" ? handler : act },
    "p.l": { component: view, loader: kind === "loader" ? handler : load },
    "p.g": { component: view, guard: kind === "guard" ? handler : gate },
  };
  return b;
};
const ownCopy = (v: object): object => {
  const o = Object.create(Object.getPrototypeOf(v));
  for (const k of Reflect.ownKeys(v)) {
    const d = Object.getOwnPropertyDescriptor(v, k);
    if (d !== undefined) Object.defineProperty(o, k, d);
  }
  return o;
};
const cloned = (v: object): unknown => {
  try {
    return structuredClone(v);
  } catch {
    return undefined;
  }
};
const roundTripped = (v: object): unknown => {
  try {
    const text = JSON.stringify(v);
    return text === undefined ? undefined : JSON.parse(text);
  } catch {
    return undefined;
  }
};
const copies = (kind: Kind): Array<[string, unknown]> => {
  const { value, other } = MADE[kind];
  return [
    ["a spread", { ...value }],
    ["a spread with another schema or target", { ...value, ...other }],
    [
      "Object.assign onto Object.create(Object.getPrototypeOf(v))",
      Object.assign(Object.create(Object.getPrototypeOf(value)), value),
    ],
    ["an object given every Reflect.ownKeys key with its descriptor", ownCopy(value)],
    ["new Proxy(v, {})", new Proxy(value, {})],
    ["structuredClone (or none, when it cannot be cloned)", cloned(value)],
    ["a JSON round trip (or none, when it has no JSON form)", roundTripped(value)],
  ];
};
const KINDS: readonly Kind[] = ["action", "loader", "guard"];

describe("k.identity in the router", () => {
  it("a made action, loader and guard are frozen", () => {
    for (const kind of KINDS) expect(Object.isFrozen(MADE[kind].value), kind).toBe(true);
  });

  it("manifest binds the made values themselves and runs none of them", () => {
    const routes = Reflect.apply(manifest, undefined, [c, bindWith("action", act)]);
    expect(isRouteTable(routes)).toBe(true);
    expect(ran.n).toBe(0);
  });

  for (const kind of KINDS) {
    const { id, member } = MADE[kind];
    for (const [how] of copies(kind)) {
      it(`manifest given ${how} in a ${kind}'s place throws E1515 naming ${id} and ${member}, and runs nothing`, () => {
        ran.n = 0;
        const forged = copies(kind).find(([h]) => h === how)?.[1];
        const e = thrown(() => Reflect.apply(manifest, undefined, [c, bindWith(kind, forged)]));
        expect(e?.message.startsWith("E1515"), e?.message).toBe(true);
        expect(e?.message).toContain(id);
        expect(e?.message).toContain(member);
        expect(ran.n).toBe(0);
      });
    }
  }

  it("a value no maker made (a plain function, an object of the made value's shape) bound as a handler is E1515, for each kind", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...KINDS),
        fc.constantFrom(() => ok(null), { fn: () => ok(null) }, {}, null, 0, "x"),
        (kind, v) => {
          const e = thrown(() => Reflect.apply(manifest, undefined, [c, bindWith(kind, v)]));
          expect(e?.message.startsWith("E1515")).toBe(true);
          expect(e?.message).toContain(MADE[kind].id);
        },
      ),
      { seed: SEED, numRuns: 50 },
    );
  });

  it("isRouteTable is true of what manifest returned, also under a second copy of @keel/router, and false of copies of it and of an object declaring a keel symbol key", async () => {
    const routes = Reflect.apply(manifest, undefined, [c, bindWith("action", act)]);
    expect(isRouteTable(routes)).toBe(true);
    expect(Object.isFrozen(routes)).toBe(true);
    vi.resetModules();
    const second = await import("@keel/router");
    expect(second.isRouteTable(routes)).toBe(true);
    expect(isRouteTable({ ...routes })).toBe(false);
    expect(isRouteTable(ownCopy(routes))).toBe(false);
    expect(isRouteTable(new Proxy(routes, {}))).toBe(false);
    for (const name of ["keel.schema", "keel.store", "keel.action", "keel.routeTable"]) {
      expect(isRouteTable({ [Symbol.for(name)]: true, kind: "keel.routeTable" })).toBe(false);
      expect(isRouteTable(Object.assign(() => 0, { [Symbol.for(name)]: true }))).toBe(false);
    }
  });
});
