// Spec: std.credentials, Modes "Per ctx, 2 run at once at `ln` 17 or 18 and 1 above; 16, 8, 4 or 2 wait in call order (`ln` 17 to 20), and a call past that is `keel.busy` (data `{ limit }`, that count)."
// Spec: std.credentials, Modes "A derivation runs off the event loop."
// Spec: std.credentials, Conformance "Under real at `ln` 17, of 19 `verify` calls started at once, 18 are `ok` and one is `keel.busy` with `limit` 16."
// Seed: 1337.
// Assumption: "off the event loop" is shown by `setImmediate` turns running while one derivation is pending (the turns counted are at least 2).
// Untestable: the wait counts at `ln` 18 to 20 (8, 4, 2) are not asserted; they cost derivations of 256 MiB to 1 GiB each, and the 17 case above is the stated conformance clause.
import { credentials } from "@keel/std-credentials/server";
import { expect, test } from "vitest";
import { errorOf, hashedOf, isOk, realCtx, secretOf } from "./fixtures.ts";

const turn = (): Promise<void> => new Promise<void>((r) => setImmediate(r));

test("Under real at `ln` 17, of 19 `verify` calls started at once, 18 are `ok` and one is `keel.busy` with `limit` 16.", async () => {
  const ctx = realCtx();
  const h = await credentials(ctx).hash(secretOf("hunter2"));
  if (!h.ok) throw new Error("hash refused a secret");
  const stored = hashedOf(h.value);
  const calls = Array.from({ length: 19 }, () => credentials(ctx).verify(secretOf("hunter2"), stored));
  const results = await Promise.all(calls);
  const ok = results.filter((r) => isOk(r));
  const busy = results.filter((r) => !isOk(r));
  expect(ok).toHaveLength(18);
  expect(busy).toHaveLength(1);
  const e = errorOf(busy[0]);
  expect(e.code).toBe("keel.busy");
  expect(e.data).toEqual({ limit: 16 });
}, 300_000);

test("A derivation runs off the event loop.", async () => {
  const ctx = realCtx();
  const pending = credentials(ctx).hash(secretOf("hunter2"));
  let settled = false;
  const done = pending.then(() => {
    settled = true;
  });
  let turns = 0;
  while (!settled) {
    await turn();
    turns += 1;
  }
  await done;
  expect(turns).toBeGreaterThanOrEqual(2);
}, 300_000);
