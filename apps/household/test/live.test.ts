import { properties } from "@keel/testing";
import { afterEach, expect, it } from "vitest";
import mount from "../identity.ts";
import { copy } from "../modules/shopping/copy.store.ts";
import { hydrate } from "../modules/shopping/hydrate.transaction.ts";
import { view } from "../modules/shopping/view.store.ts";
import { stream, gracePage, household } from "./household.ts";
import { asJson, formPost } from "./serve.ts";

const views = view.snapshot();
const copies = copy.snapshot();
afterEach(() => {
  expect(view.restore(views).ok && copy.restore(copies).ok).toBe(true);
});

it("shows on Grace's open page what Ada adds, buys and removes, without a reload", async () => {
  const h = await household(11);
  const page = await gracePage(h);
  await page.settle();
  expect(page.find("shopping.live").text).toBe("Live: changes from your household show here");
  expect(page.find("shopping.empty").text).toContain("The list is empty");

  await h.raw(asJson("POST", "/api/items", { name: "Milk" }, { cookie: h.adaCookie }));
  await page.settle();
  const [milk] = copy.get("items");
  expect(milk).toMatchObject({ name: "Milk", qty: 1, bought: false });
  expect(page.find(`shopping.name.${milk?.id}`).text).toBe("Milk × 1");

  await h.raw(asJson("POST", `/api/items/${milk?.id}/toggle`, undefined, { cookie: h.adaCookie }));
  await page.settle();
  expect(copy.get("items")).toEqual([{ ...milk, bought: true }]);

  await h.raw(asJson("DELETE", `/api/items/${milk?.id}`, undefined, { cookie: h.adaCookie }));
  await page.settle();
  expect(page.find("shopping.empty").text).toContain("The list is empty");
  page.dispose();
});

it("tells Ada's stream that the list changed when Grace's page adds, and carries no item or member", async () => {
  const h = await household(12);
  const ada = await stream(h, h.adaCookie);
  expect(await ada.next()).toEqual({ ok: true, value: { kind: "reset" } });
  const page = await gracePage(h);
  await page.fire("shopping.staples.trigger", { type: "click" });
  await page.fire("shopping.staples.item.eggs", { type: "click" });
  const saved = await ada.next();
  expect(saved).toEqual({ ok: true, value: { kind: "saved", store: "shopping.changes", head: expect.any(Number) } });
  expect(JSON.stringify(saved)).not.toMatch(/Eggs|grace|Grace|Ada|ada@/);
  const listed = await (await h.raw(asJson("GET", "/api/items", undefined, { cookie: h.adaCookie }))).json();
  expect(listed.results["shopping.items"].value.items).toEqual([expect.objectContaining({ name: "Eggs", qty: 1 })]);
  page.dispose();
  await ada.close();
});

it("shows Offline through a drop, then catches up with what changed while it was away", async () => {
  const h = await household(15);
  const page = await gracePage(h);
  await page.settle();
  h.ctx.net.setOnline(false);
  await page.settle();
  expect(page.find("shopping.live").text).toBe("Offline: this list shows what it held when the connection dropped");
  await h.raw(asJson("POST", "/api/items", { name: "Apples" }, { cookie: h.adaCookie }));
  await page.settle();
  expect(page.find("shopping.empty").text).toContain("The list is empty");
  h.ctx.net.setOnline(true);
  await page.settle();
  expect(page.find("shopping.live").text).toBe("Live: changes from your household show here");
  expect(copy.get("items")).toEqual([expect.objectContaining({ name: "Apples", qty: 1 })]);
  page.dispose();
});

it("gives a visitor's stream one closed denied and nothing after it", async () => {
  const h = await household(13);
  const visitor = await stream(h, "");
  expect(visitor.res.headers.has("set-cookie")).toBe(false);
  expect(await visitor.next()).toEqual({ ok: true, value: { kind: "closed", reason: "denied" } });
  await h.raw(asJson("POST", "/api/items", { name: "Bread" }, { cookie: h.adaCookie }));
  expect(await visitor.next()).toBe(null);
});

it("refuses the re-read of a member who signed out, so the list does not reach them", async () => {
  // The stream keeps the user it opened with (std.channels `member`), so it still hears `saved`; what reaches a
  // signed-out browser is that the list changed, and its re-read is refused.
  const h = await household(14);
  const grace = await stream(h, h.graceCookie);
  expect(await grace.next()).toEqual({ ok: true, value: { kind: "reset" } });
  await h.raw(formPost(mount.href("/sign-out"), {}, h.graceCookie));
  await h.raw(asJson("POST", "/api/items", { name: "Rice" }, { cookie: h.adaCookie }));
  const after = await grace.next();
  const reread = await h.raw(asJson("GET", "/api/items", undefined, { cookie: h.graceCookie }));
  expect(reread.status).toBe(403);
  expect(after).toEqual({ ok: true, value: { kind: "saved", store: "shopping.changes", head: 1 } });
  await grace.close();
});

it("hydrates any list the server can answer, and undoes it", async () => {
  await properties(hydrate, { runs: 100, seed: 8 });
});
