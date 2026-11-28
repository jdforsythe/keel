// Spec: k.fixes, clause "The chains `sdk`, `json`, `timeout` and `conflict` each end in a project whose probe holds: the expected failure is `err` with the code the end names, and a `TypeError` thrown inside the wrapped call is thrown on as itself."
// Seed 1337. A conflict is retried: two conflicts then a value is ok after three runs; conflicts on every run give err keel.conflict after `tries` runs.
import { expect, test } from "vitest";
import { save } from "./end/save.ts";

const conflict = () => Object.assign(new Error("deadlock"), { name: "ConflictError" });

test("two conflicts then a value is ok after three runs", async () => {
  let n = 0;
  const r = await save(async () => {
    if (++n < 3) throw conflict();
    return 7;
  }, 5);
  expect(r).toEqual({ ok: true, value: 7 });
  expect(n).toBe(3);
});

test("a conflict on every run is err keel.conflict after `tries` runs", async () => {
  let n = 0;
  const r = await save(async () => {
    n++;
    throw conflict();
  }, 3);
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.error.code).toBe("keel.conflict");
  expect(n).toBe(3);
});

test("a TypeError thrown inside the wrapped call is thrown on as itself", async () => {
  const w = new TypeError("x");
  await expect(
    save(async () => {
      throw w;
    }, 3),
  ).rejects.toBe(w);
});
