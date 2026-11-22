import { renderRoute } from "@keel/testing";
import { expect, it } from "vitest";
import { copyOf, household, listPage } from "./household.ts";
import { drive, ended, listOn, restocksOn, runsOn, turn } from "./restock.ts";
import { asJson, served, webRoutes } from "./serve.ts";

const click = { type: "click" } as const;
const STAPLES = ["Milk × 1", "Bread × 1", "Eggs × 1", "Rice × 1", "Apples × 1"];

it("puts each staple back with a job of its own, two seconds apart, and ends once", async () => {
  const { ctx, fetch } = await served(41);
  const started = await (await fetch(asJson("POST", "/api/restock"))).json();
  expect(started.value.last).toMatchObject({ by: "member", state: "running", handled: 0, total: 5 });
  // A second Run now while the run goes starts nothing: the same run answers.
  const again = await (await fetch(asJson("POST", "/api/restock"))).json();
  expect(again.value.kept).toBe(1);

  const turns = await drive(ctx, ended);
  expect(turns).toBeGreaterThanOrEqual(16); // four rests of 2,000 ms on a clock moved 500 ms a turn
  expect((await runsOn(ctx)).last).toMatchObject({ state: "done", handled: 5, putBack: 5, total: 5, code: "" });
  expect(await listOn(ctx)).toEqual(STAPLES);
  expect((await restocksOn(ctx)).map((r) => r.name).sort()).toEqual(["Apples", "Bread", "Eggs", "Milk", "Rice"]);

  // A finished run stays as it was: more time changes nothing, and the next Run now starts a second one.
  await drive(ctx, () => false, 10);
  expect(await listOn(ctx)).toEqual(STAPLES);
  const second = await (await fetch(asJson("POST", "/api/restock"))).json();
  expect(second.value.kept).toBe(2);
}, 60_000);

it("leaves a staple still to buy as it is and puts a bought one back to buy", async () => {
  const { ctx, fetch } = await served(42);
  await fetch(asJson("POST", "/api/items", { name: "Milk" }));
  await fetch(asJson("POST", "/api/items", { name: "Milk" }));
  const added = await (await fetch(asJson("POST", "/api/items", { name: "Eggs" }))).json();
  const eggs = added.value.items.find((i: { name: string }) => i.name === "Eggs");
  await fetch(asJson("POST", `/api/items/${eggs.id}/toggle`));
  await fetch(asJson("POST", "/api/restock"));
  await drive(ctx, ended);
  expect((await runsOn(ctx)).last).toMatchObject({ state: "done", handled: 5, putBack: 4 });
  expect(await listOn(ctx)).toEqual(["Milk × 2", "Eggs × 1", "Bread × 1", "Rice × 1", "Apples × 1"]);
}, 60_000);

it("refuses Run now and the runs to a visitor", async () => {
  const { raw } = await served(43, false);
  expect((await raw(asJson("POST", "/api/restock"))).status).toBe(403);
  expect((await raw(asJson("GET", "/api/restock"))).status).toBe(403);
});

it("shows the staples arriving on Grace's open list while Ada's run puts them back", async () => {
  const h = await household(44);
  const grace = await listPage(h, h.graceId);
  expect(copyOf(grace).items).toEqual([]);
  await h.raw(asJson("POST", "/api/restock", undefined, { cookie: h.adaCookie }));
  let seen = 0;
  for (let n = 0; n < 80 && seen < 5; n++) {
    await turn(h.ctx);
    await grace.settle();
    const now = copyOf(grace).items.length;
    // The staples arrive one at a time: the page never skips from none to all.
    expect(now - seen).toBeLessThanOrEqual(1);
    seen = now;
  }
  expect(copyOf(grace).items.map((i) => `${i.name} × ${i.qty}`)).toEqual(STAPLES);
  grace.dispose();
}, 60_000);

it("shows the last run on the setup page, and Run now starts one the page follows to its end", async () => {
  const { ctx, app, user } = await served(45);
  const page = await renderRoute("setup.form", { routes: webRoutes, params: {}, ctx, app, user });
  expect(page.find("shopping.restock.heading").text).toBe("Weekly staples");
  expect(page.find("shopping.restock.last").text).toBe(
    "No run yet. The first starts on Saturday, or when you select Run now.",
  );
  expect(page.focusOrder().slice(-2)).toEqual(["setup.save", "shopping.restock.run"]);

  await page.fire("shopping.restock.run", click);
  // The fire settles once the page is quiet, by when the first staple's job may have run.
  expect(page.find("shopping.restock.last").text).toMatch(/^Running: [01] of 5 staples handled, [01] put back\.$/);
  expect(page.find("shopping.restock.last").role).toBe("status");
  expect(page.find("shopping.restock.started").text).toBe("Started by a member, Jan 1, 1970, 12:00:00 AM UTC");
  for (let n = 0; n < 80 && !page.find("shopping.restock.last").text.startsWith("Done"); n++) {
    await turn(ctx);
    await page.settle();
  }
  expect(page.find("shopping.restock.last").text).toBe("Done: 5 of 5 staples handled, 5 put back.");
  expect(page.find("shopping.restock.refused").text).toBe("");
  page.dispose();
}, 60_000);
