import { renderRoute } from "@keel/testing";
import { expect, it } from "vitest";
import { copyOf, household, listPage } from "./household.ts";
import { alone, listOn, restocksOn, runsOn } from "./restock.ts";
import { asJson, served, webRoutes } from "./serve.ts";

const click = { type: "click" } as const;
const STAPLES = ["Milk × 1", "Bread × 1", "Eggs × 1", "Rice × 1", "Apples × 1"];

it(
  "puts each staple back with a job of its own, two seconds apart, and ends once",
  () =>
    alone(41, async ({ ctx, run }) => {
      const { fetch } = await served(41, true, ctx);
      const started = await (await fetch(asJson("POST", "/api/restock"))).json();
      expect(started.value.last).toMatchObject({ by: "member", state: "running", handled: 0, total: 5 });
      // A second Run now while the run goes starts nothing: the same run answers.
      const again = await (await fetch(asJson("POST", "/api/restock"))).json();
      expect(again.value.kept).toBe(1);

      await run(7_000); // four rests of 2,000 ms after the first staple: the last is not due
      expect((await runsOn(ctx)).last?.state).toBe("running");
      await run(10_000);
      expect((await runsOn(ctx)).last).toMatchObject({ state: "done", handled: 5, putBack: 5, total: 5, code: "" });
      expect(await listOn(ctx)).toEqual(STAPLES);
      expect((await restocksOn(ctx)).map((r) => r.name).sort()).toEqual(["Apples", "Bread", "Eggs", "Milk", "Rice"]);

      // A finished run stays as it was: more time changes nothing, and the next Run now starts a second one.
      await run(5_000);
      expect(await listOn(ctx)).toEqual(STAPLES);
      const second = await (await fetch(asJson("POST", "/api/restock"))).json();
      expect(second.value.kept).toBe(2);
    }),
  60_000,
);

it(
  "leaves a staple still to buy as it is and puts a bought one back to buy",
  () =>
    alone(42, async ({ ctx, run }) => {
      const { fetch } = await served(42, true, ctx);
      await fetch(asJson("POST", "/api/items", { name: "Milk" }));
      await fetch(asJson("POST", "/api/items", { name: "Milk" }));
      const added = await (await fetch(asJson("POST", "/api/items", { name: "Eggs" }))).json();
      const eggs = added.value.items.find((i: { name: string }) => i.name === "Eggs");
      await fetch(asJson("POST", `/api/items/${eggs.id}/toggle`));
      await fetch(asJson("POST", "/api/restock"));
      await run(20_000);
      expect((await runsOn(ctx)).last).toMatchObject({ state: "done", handled: 5, putBack: 4 });
      expect(await listOn(ctx)).toEqual(["Milk × 2", "Eggs × 1", "Bread × 1", "Rice × 1", "Apples × 1"]);
    }),
  60_000,
);

it("refuses Run now and the runs to a visitor", async () => {
  const { raw } = await served(43, false);
  expect((await raw(asJson("POST", "/api/restock"))).status).toBe(403);
  expect((await raw(asJson("GET", "/api/restock"))).status).toBe(403);
});

it(
  "shows the staples arriving on Grace's open list while Ada's run puts them back",
  () =>
    alone(44, async ({ ctx, run }) => {
      const h = await household(44, ctx);
      const grace = await listPage(h, h.graceId);
      expect(copyOf(grace).items).toEqual([]);
      await h.raw(asJson("POST", "/api/restock", undefined, { cookie: h.adaCookie }));
      let seen = 0;
      // The page reaches the server through its own app, real I/O the run does not hold: each turn gives it a few more
      // event-loop turns, and the loop ends when the staples are on the list, not at a time.
      for (let n = 0; n < 600 && seen < 5; n++) {
        await run(500);
        await grace.settle();
        const now = copyOf(grace).items.length;
        // The staples arrive one at a time: the page never skips from none to all.
        expect(now - seen).toBeLessThanOrEqual(1);
        seen = now;
      }
      expect(copyOf(grace).items.map((i) => `${i.name} × ${i.qty}`)).toEqual(STAPLES);
      grace.dispose();
    }),
  60_000,
);

it(
  "shows the last run on the setup page, and Run now starts one the page follows to its end",
  () =>
    alone(45, async ({ ctx, run }) => {
      const { app, user } = await served(45, true, ctx);
      const page = await renderRoute("setup.form", { routes: webRoutes, params: {}, ctx, app, user });
      expect(page.find("shopping.restock.heading").text).toBe("Weekly staples");
      expect(page.find("shopping.restock.last").text).toBe(
        "No run yet. The first starts on Saturday, or when you select Run now.",
      );
      expect(page.focusOrder().slice(-3)).toEqual(["setup.save", "shopping.restock.run", "app.recording.note.button"]);

      await page.fire("shopping.restock.run", click);
      // The fire settles once the page is quiet, by when the first staple's job may have run.
      expect(page.find("shopping.restock.last").text).toMatch(/^Running: [01] of 5 staples handled, [01] put back\.$/);
      expect(page.find("shopping.restock.last").role).toBe("status");
      expect(page.find("shopping.restock.started").text).toBe("Started by a member, Jan 1, 1970, 12:00:00 AM UTC");
      // As above: the page waits on its own requests to the server, so the loop ends on the page showing the run done.
      for (let n = 0; n < 600 && !page.find("shopping.restock.last").text.startsWith("Done"); n++) {
        await run(500);
        await page.settle();
      }
      expect(page.find("shopping.restock.last").text).toBe("Done: 5 of 5 staples handled, 5 put back.");
      expect(page.find("shopping.restock.live").text).toBe("Live: a run shows here as it goes");
      expect(page.find("shopping.restock.live").role).toBe("status");
      expect(page.find("shopping.restock.refused").text).toBe("");
      page.dispose();
    }),
  60_000,
);
