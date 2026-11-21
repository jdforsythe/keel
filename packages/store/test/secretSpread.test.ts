// A transaction that copies a payload's `s.secret` value into state under a key the state schema does not declare.
// Live state must never hold a secret: the commit is refused, and snapshot, restore and replay agree with live state.
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import { expect, test } from "vitest";
import { store, transaction, tx } from "../src/index.ts";

const State = s.object({ name: s.string() });
// Wire data: an unknown payload is validated at run time, which builds the Secret.
const wire = (x: object): unknown => x;
const Login = s.object({ name: s.string(), token: s.secret(s.string()) });

function make() {
  const box: { kit?: ReturnType<typeof build> } = {};
  const build = () => {
    const c = store(State, { name: "" });
    const spread = transaction(c, "spread.login", Login, (st, p) => ({ ...st, ...p }));
    const nested = transaction(c, "spread.nested", s.object({ user: Login }), (st, p) => ({
      ...st,
      extra: { user: p.user },
    }));
    return { c, spread, nested };
  };
  const sc = scope(() => {
    box.kit = build();
  });
  if (box.kit === undefined) throw new Error("scope body did not run");
  return { ...box.kit, dispose: sc.dispose };
}

test("a spread that copies a secret into an undeclared key commits nothing", () => {
  const k = make();
  expect(() => tx(k.spread, wire({ name: "a", token: "t-1" }))).toThrow();
  expect(Object.keys(k.c.snapshot().state)).toEqual(["name"]);
  expect(k.c.log()).toEqual([]);
  k.dispose();
});

test("a secret nested under an undeclared key is refused too", () => {
  const k = make();
  expect(() => tx(k.nested, wire({ user: { name: "a", token: "t-2" } }))).toThrow();
  expect(k.c.log()).toEqual([]);
  k.dispose();
});
