import { explore, properties } from "@keel/testing";
import { expect, it } from "vitest";
import { show } from "../modules/shopping/show.transaction.ts";

it("show undoes exactly", async () => {
  await properties(show, { runs: 100, seed: 11 });
});

it("reaches both tabs and nothing else", () => {
  const r = explore([show]);
  expect(r.complete).toBe(true);
  expect(r.states).toHaveLength(2);
});
