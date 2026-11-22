import { it } from "vitest";

it("aborts", async () => {
  await new Promise((r) => setTimeout(r, 100));
  process.stderr.write("FATAL ERROR: Reached heap limit Allocation failed\n");
  process.abort();
});
