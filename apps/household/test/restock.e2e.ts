// The weekly staples run on the setup page: Run now starts a run, the server is killed with SIGKILL while it goes and
// started again over the same data, and the run ends once, done, with each staple on the list once.
import { fixedTime } from "@keel/tooling/test-time";
import { expect, it } from "vitest";
import { household, itemsOf, member, read, runsOf, unexpected } from "./householdApp.ts";

it(
  "after a kill mid-run the run ends once, done, the page shows it and the list holds each staple once",
  // The run's own time is an input: a step the killed server held runs again after its 10 s timeout and a second, and
  // four 2 s waits lie between the five staples (8 s); 60 s is the allowance on top, with the kill and the restart.
  { timeout: fixedTime(19_000) + fixedTime(120_000) },
  async () => {
    const { served } = await household();
    const page = await member(served, "Ada Lovelace", "ada@example.com");
    await page.navigate("/setup");
    await page.until("shopping.restock.last", { text: /^No run yet/ });

    await page.fire("shopping.restock.run", { type: "click" });
    await page.until("shopping.restock.last", { text: /^Running/ });
    await page.until("shopping.restock.last", { text: /^Running: [1-9]/ }, { fixed: 15_000 });
    const mid = await runsOf(await page.fetch("/api/restock", { headers: read }));
    expect(mid.last?.state).toBe("running");
    expect(mid.last?.handled ?? 0).toBeGreaterThanOrEqual(1);

    await served.stop();
    await served.start();
    await page.until("shopping.restock.last", { text: /^Done/ }, { fixed: fixedTime(19_000) + fixedTime(60_000) });
    const final = await runsOf(await page.fetch("/api/restock", { headers: read }));
    expect(final.kept).toBe(1);
    expect(final.last?.state).toBe("done");
    expect(final.last?.putBack).toBe(5);
    const restocked = (await itemsOf(await page.fetch("/api/items", { headers: read }))).map(
      (i) => `${i.name} × ${i.qty}`,
    );
    expect(restocked).toEqual(["Milk × 1", "Bread × 1", "Eggs × 1", "Rice × 1", "Apples × 1"]);
    expect(unexpected(page)).toEqual([]);
  },
);
