// Spec: k.fixes, clause "The chains `sdk`, `json`, `timeout` and `conflict` each end in a project whose probe holds: the expected failure is `err` with the code the end names, and a `TypeError` thrown inside the wrapped call is thrown on as itself."
// Seed 1337.
import { expect, test } from "vitest";
import { load } from "./end/load.ts";

test("a TimeoutError is err feed.timeout", async () => {
  const r = await load({ get: async () => Promise.reject(Object.assign(new Error("slow"), { name: "TimeoutError" })) });
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.error.code).toBe("feed.timeout");
});

test("a TypeError thrown inside the wrapped call is thrown on as itself", async () => {
  const w = new TypeError("fetch failed");
  await expect(load({ get: async () => Promise.reject(w) })).rejects.toBe(w);
});

test("a value is ok", async () => {
  await expect(load({ get: async () => "x" })).resolves.toEqual({ ok: true, value: "x" });
});
