// Spec: k.drive (Driving): a crypto call that returns at once makes no pending work, though Node destroys its job only
// at a garbage collection; one with a callback is a request and is pending until it answers.
import { pbkdf2, randomBytes } from "node:crypto";
import { simulate } from "@keel/testing";
import { expect, it } from "vitest";

const replay = { seed: 1, schedule: { net: [], storage: [], offline: [], plans: {} } };

it("a synchronous randomBytes call is not work that outlived the scenario", async () => {
  await simulate(
    async () => {
      for (let i = 0; i < 20; i++) randomBytes(8);
    },
    { replay },
  );
});

it("a pbkdf2 request the scenario does not await is work that outlived it", async () => {
  const e = await simulate(
    async () => {
      pbkdf2("a", "b", 3_000_000, 64, "sha512", () => {});
    },
    { replay },
  ).catch((error: unknown) => error);
  expect(String(e).split("\n")[0]).toContain("E1728 work outlived the scenario: PBKDF2REQUEST");
});
