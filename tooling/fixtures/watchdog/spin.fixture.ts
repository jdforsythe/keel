import { it } from "vitest";

it("spins without yielding", () => {
  for (;;) {}
});
