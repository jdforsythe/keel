// @vitest-environment node
import { prove } from "@keel/testing/prove";
import { expect, it } from "vitest";
import { addCost } from "../modules/trip/addCost.ts";
import { addPerson } from "../modules/trip/addPerson.ts";

it("the trip's invariants hold in every state and payload the schemas allow", async () => {
  const r = await prove([addPerson, addCost]);
  expect([...r.proven].sort()).toEqual(["trip.addCost", "trip.addPerson"]);
}, 60_000);
