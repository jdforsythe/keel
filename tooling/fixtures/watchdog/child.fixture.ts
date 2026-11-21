import { spawn } from "node:child_process";
import fs from "node:fs";
import { it } from "vitest";

// Starts a long-lived child of the worker, tells the test both pids through the ready file, and waits far beyond
// the test's own wait: only the worker ending can end this test early.
it("holds a child process", { timeout: 600_000 }, async () => {
  const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "ignore" });
  const ready = process.env.KEEL_WATCHDOG_READY;
  if (ready) fs.writeFileSync(ready, `${process.pid} ${child.pid}`);
  await new Promise((r) => setTimeout(r, 600_000));
});
