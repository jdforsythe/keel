import { tx } from "@keel/store";
// @vitest-environment happy-dom
// Spec: k.sim, Conformance "A module store written by one run holds its pre-`simulate` state when the next run starts and after `simulate` resolves."
// Seed: 1337.
import { simulate } from "@keel/testing";
import { describe, expect, it } from "vitest";
import { SEED, addItem, cart } from "./fixtures.ts";

describe("k.sim: stores are restored around runs", () => {
  it("a module store written by one run holds its pre-`simulate` state when the next run starts", async () => {
    tx(addItem, { item: { id: "before", qty: 1 } });
    const before = cart.get("items").map((i) => i.id);
    const atStart: string[][] = [];
    await simulate(
      async ({ run }) => {
        atStart.push(cart.get("items").map((i) => i.id));
        tx(addItem, { item: { id: "written-by-run", qty: 2 } });
        await run();
      },
      { runs: 10, seed: SEED, law: false },
    );
    expect(atStart).toHaveLength(10);
    for (const items of atStart) expect(items).toEqual(before);
  });

  it("a module store written by one run holds its pre-`simulate` state after `simulate` resolves", async () => {
    const before = cart.snapshot();
    await simulate(
      async ({ run }) => {
        tx(addItem, { item: { id: "x", qty: 1 } });
        await run();
      },
      { runs: 10, seed: SEED },
    );
    expect(cart.snapshot()).toEqual(before);
  });

  it("a store written by a failing run is restored too", async () => {
    const before = cart.snapshot();
    await simulate(
      async () => {
        tx(addItem, { item: { id: "doomed", qty: 1 } });
        throw new Error("scenario fails");
      },
      { runs: 3, seed: SEED },
    ).catch(() => undefined);
    expect(cart.snapshot()).toEqual(before);
  });
});
