import fs from "node:fs";
import { it } from "vitest";

// Its timeout is far beyond the test's wait: only the orphan check can end it in time. The ready file tells the
// test the worker (its pid) is spinning with the watchdog started.
it("spins until its parent is gone", { timeout: 600_000 }, () => {
  const ready = process.env.KEEL_WATCHDOG_READY;
  if (ready) fs.writeFileSync(ready, String(process.pid));
  for (;;) {}
});
