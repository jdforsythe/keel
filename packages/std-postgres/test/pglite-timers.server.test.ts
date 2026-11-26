// k.drive Seams: the shared PGlite is made outside a `simulate` run. The wall-clock timer Postgres arms inside PGlite
// for its statistics flush (10 s, through `setitimer`, a Node `setTimeout`) is made in PGlite's own async context,
// never in the caller's, so a run's drive never waits one out in real time.
import { AsyncLocalStorage, createHook } from "node:async_hooks";
import { fixedTime, testTime } from "@keel/tooling/test-time";
import { expect, test } from "vitest";
import { simEngine } from "../src/server/internal/simEngine.server.ts";

/**
 * How long statements run before the test gives up on seeing the timer armed: Postgres's 10 s statistics idle
 * interval, after which a timer armed while the engine opened has fired, and a margin. An input to the code under
 * test, so fixed time.
 */
const WITHIN_MS = fixedTime(15_000);

test(
  "Postgres's statistics timer is made in PGlite's async context, not the caller's",
  async () => {
    const engine = await simEngine();
    // Statistics are pending only after a statement touched a table.
    await engine.statement("create table if not exists keel_timer_probe (n int)", [], (start) => start());
    const caller = new AsyncLocalStorage<string>();
    const timers: string[] = [];
    const hook = createHook({
      init(_id, type) {
        if (type === "Timeout") timers.push(caller.getStore() ?? "pglite");
      },
    });
    const started = performance.now();
    hook.enable();
    try {
      // Statements back to back in the caller's context: once no flush timer is armed, one that ends within a second
      // of a flush arms it.
      await caller.run("caller", async () => {
        while (!timers.includes("pglite") && !timers.includes("caller") && performance.now() - started < WITHIN_MS) {
          await engine.statement("insert into keel_timer_probe values (1)", [], (start) => start());
        }
      });
    } finally {
      hook.disable();
    }
    expect(timers).toContain("pglite");
    expect(timers).not.toContain("caller");
  },
  WITHIN_MS + testTime(10_000),
);
