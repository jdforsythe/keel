// Spec: k.fixes, clause "The chains `sdk`, `json`, `timeout` and `conflict` each end in a project whose probe holds: the expected failure is `err` with the code the end names, and a `TypeError` thrown inside the wrapped call is thrown on as itself."
// Seed 1337. The SDK is a fake whose `create` is replaced per case.
import { expect, test } from "vitest";
import { charge } from "./end/charge.ts";
import { sdk } from "./end/sdk.ts";

const reject = (e: unknown) => {
  sdk.charges.create = async () => {
    throw e;
  };
};

test("a CardError is err pay.declined with a closed reason, and the SDK's message appears nowhere", async () => {
  reject(Object.assign(new Error("card declined for jane@x.com"), { name: "CardError", code: "expired_card" }));
  const r = await charge({ amount: 1 });
  expect(r.ok).toBe(false);
  if (r.ok) return;
  expect(r.error.code).toBe("pay.declined");
  expect(r.error.data).toEqual({ reason: "expired" });
  expect(JSON.stringify(r)).not.toContain("jane");
});

test("a TypeError thrown inside the wrapped call is thrown on as itself", async () => {
  const w = new TypeError("fetch failed");
  reject(w);
  await expect(charge({ amount: 1 })).rejects.toBe(w);
});
