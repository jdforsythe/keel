// Spec: std.timings, clause "Registering another inspector with id `timings.recent` throws E1057."
// Seed 1337
import { inspector } from "@keel/compiler/inspect/inspector";
import { s } from "@keel/schema";
import "@keel/std-timings";
import { expect, test } from "vitest";

test("Registering another inspector with id `timings.recent` throws E1057", () => {
  let caught: unknown;
  try {
    inspector({ id: "timings.recent", schema: s.int(), read: () => 1 });
  } catch (e) {
    caught = e;
  }
  expect(caught).toBeInstanceOf(Error);
  expect(caught instanceof Error ? caught.message : "").toMatch(/^E1057/);
});
