import { scope } from "@keel/reactive";
import { properties } from "@keel/testing";
import { isolate, tx } from "@keel/store";
import { expect, test } from "vitest";
import { Signup } from "../modules/shifts/Signup.schema.ts";
import { board } from "../modules/shifts/board.ts";

const made = (n: number, shiftId: string, owner: string) =>
  Signup.parse({
    id: `00000000-0000-4000-8000-00000000000${n}`,
    shiftId,
    name: `Volunteer ${n}`,
    email: `v${n}@example.org`,
    owner,
    attended: false,
  });

const fresh = () => {
  const sc = scope(() => undefined);
  isolate(sc);
  return sc.run(() => board());
};

test("signUp keeps the board valid for every payload", async () => {
  await properties(fresh().signUp, { runs: 100, seed: 7 });
});

test("cancel keeps the board valid for every payload", async () => {
  await properties(fresh().cancel, { runs: 100, seed: 7 });
});

test("markAttended keeps the board valid for every payload", async () => {
  await properties(fresh().markAttended, { runs: 100, seed: 7 });
});

test("a sign-up is added, and an unknown shift leaves the state unchanged", () => {
  const stores = fresh();
  const one = made(1, "s1", "a");
  const stray = made(2, "nope", "a");
  expect(one.ok && stray.ok).toBe(true);
  if (!one.ok || !stray.ok) return;
  expect(tx(stores.signUp, one.value).ok).toBe(true);
  expect(tx(stores.signUp, stray.value).ok).toBe(true);
  expect(stores.board.get("signups")).toEqual([one.value]);
});

test("a full shift takes no more sign-ups", () => {
  const stores = fresh();
  const first = made(1, "s3", "a");
  const second = made(2, "s3", "b");
  const third = made(3, "s3", "c");
  expect(first.ok && second.ok && third.ok).toBe(true);
  if (!first.ok || !second.ok || !third.ok) return;
  expect(tx(stores.signUp, first.value).ok).toBe(true);
  expect(tx(stores.signUp, second.value).ok).toBe(true);
  expect(tx(stores.signUp, third.value).ok).toBe(true);
  expect(stores.board.get("signups").map((x) => x.id)).toEqual([first.value.id, second.value.id]);
});

test("cancel removes a sign-up only for its owner", () => {
  const stores = fresh();
  const one = made(1, "s1", "a");
  expect(one.ok).toBe(true);
  if (!one.ok) return;
  expect(tx(stores.signUp, one.value).ok).toBe(true);
  expect(tx(stores.cancel, { id: one.value.id, owner: "b" }).ok).toBe(true);
  expect(stores.board.get("signups")).toHaveLength(1);
  expect(tx(stores.cancel, { id: one.value.id, owner: "a" }).ok).toBe(true);
  expect(stores.board.get("signups")).toHaveLength(0);
});

test("markAttended sets the attendance of one sign-up", () => {
  const stores = fresh();
  const one = made(1, "s1", "a");
  expect(one.ok).toBe(true);
  if (!one.ok) return;
  expect(tx(stores.signUp, one.value).ok).toBe(true);
  expect(tx(stores.markAttended, { id: one.value.id, attended: true }).ok).toBe(true);
  expect(stores.board.get("signups").map((x) => x.attended)).toEqual([true]);
});

test("the invariant refuses an overfull shift, a duplicate id and an unknown shift", () => {
  const stores = fresh();
  const rows = [made(1, "s3", "a"), made(2, "s3", "b"), made(3, "s3", "c"), made(4, "nope", "d")];
  const values = rows.flatMap((r) => (r.ok ? [r.value] : []));
  expect(values).toHaveLength(4);
  const shifts = stores.board.get("shifts");
  expect(stores.board.check({ shifts, signups: values.slice(0, 2) }).ok).toBe(true);
  expect(stores.board.check({ shifts, signups: values.slice(0, 3) }).ok).toBe(false);
  expect(
    stores.board.check({ shifts, signups: [values[0], values[0]].flatMap((v) => (v === undefined ? [] : [v])) }).ok,
  ).toBe(false);
  expect(stores.board.check({ shifts, signups: values.slice(3) }).ok).toBe(false);
});
