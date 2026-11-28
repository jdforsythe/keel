import { it } from "vitest";

it("is killed", async () => {
  await new Promise((r) => setTimeout(r, 100));
  process.kill(process.pid, "SIGKILL");
});
