import { properties } from "@keel/testing";
import { expect, it } from "vitest";
import mount from "../identity.ts";
import { hydrate } from "../modules/shopping/hydrate.transaction.ts";
import { stream, copyOf, household, listPage } from "./household.ts";
import { asJson, formPost } from "./serve.ts";

const click = { type: "click" } as const;
const LIVE = "Live: changes from your household show here";

it("shows on Grace's open page what Ada's page adds, buys and removes, without a reload", async () => {
  const h = await household(11);
  const ada = await listPage(h, h.user);
  const grace = await listPage(h, h.graceId);
  expect(ada.find("shopping.live").text).toBe(LIVE);
  expect(grace.find("shopping.live").text).toBe(LIVE);
  expect(grace.find("shopping.empty").text).toContain("The list is empty");

  await ada.fire("shopping.staples.trigger", click);
  await ada.fire("shopping.staples.item.eggs", click);
  await grace.settle();
  const [eggs] = copyOf(grace).items;
  expect(eggs).toMatchObject({ name: "Eggs", qty: 1, bought: false });
  expect(grace.find(`shopping.name.${eggs?.id}`).text).toBe("Eggs × 1");
  // Ada's open menu and her tab are her page's own: Grace's widgets and view did not move.
  expect(grace.find("shopping.staples.trigger").state.expanded).toBe(false);

  await ada.fire("shopping.view.tab.bought", click);
  await ada.fire(`shopping.toggle.${eggs?.id}`, click);
  await grace.settle();
  expect(copyOf(grace).items).toEqual([{ ...eggs, bought: true }]);
  expect(grace.find("shopping.view.tab.toBuy").state.selected).toBe(true);
  expect(grace.state()["shopping.view"]).toEqual({ show: "toBuy" });
  expect(ada.state()["shopping.view"]).toEqual({ show: "bought" });

  await ada.fire(`shopping.remove.${eggs?.id}`, click);
  await grace.settle();
  expect(copyOf(grace).items).toEqual([]);
  expect(grace.find("shopping.empty").text).toContain("The list is empty");
  ada.dispose();
  grace.dispose();
});

it("tells Ada's stream that the list changed when Grace's page adds, and carries no item or member", async () => {
  const h = await household(12);
  const ada = await stream(h, h.adaCookie);
  expect(await ada.next()).toEqual({ ok: true, value: { kind: "reset" } });
  const page = await listPage(h, h.graceId);
  await page.fire("shopping.staples.trigger", click);
  await page.fire("shopping.staples.item.eggs", click);
  const changed = await ada.next();
  expect(changed).toEqual({ ok: true, value: { kind: "changed" } });
  expect(JSON.stringify(changed)).not.toMatch(/Eggs|grace|Grace|Ada|ada@/);
  const listed = await (await h.raw(asJson("GET", "/api/items", undefined, { cookie: h.adaCookie }))).json();
  expect(listed.results["shopping.items"].value.items).toEqual([expect.objectContaining({ name: "Eggs", qty: 1 })]);
  page.dispose();
  await ada.close();
});

it("shows Offline through a drop, then catches up with what changed while it was away", async () => {
  const h = await household(15);
  const page = await listPage(h, h.graceId);
  await page.settle();
  h.ctx.net.setOnline(false);
  await page.settle();
  expect(page.find("shopping.live").text).toBe("Offline: this list shows what it held when the connection dropped");
  await h.raw(asJson("POST", "/api/items", { name: "Apples" }, { cookie: h.adaCookie }));
  await page.settle();
  expect(page.find("shopping.empty").text).toContain("The list is empty");
  h.ctx.net.setOnline(true);
  await page.settle();
  expect(page.find("shopping.live").text).toBe(LIVE);
  expect(copyOf(page).items).toEqual([expect.objectContaining({ name: "Apples", qty: 1 })]);
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

it("closes the stream of a member who signed out, at the next change, so the list does not reach them", async () => {
  // Before each delivery the stream asks who its request belongs to now (std.channels, k.user `currentUser`): Grace's
  // session is gone, so the change closes her stream `denied` in place of `changed`, and a re-read is refused too.
  const h = await household(14);
  const grace = await stream(h, h.graceCookie);
  expect(await grace.next()).toEqual({ ok: true, value: { kind: "reset" } });
  await h.raw(formPost(mount.href("/sign-out"), {}, h.graceCookie));
  await h.raw(asJson("POST", "/api/items", { name: "Rice" }, { cookie: h.adaCookie }));
  expect(await grace.next()).toEqual({ ok: true, value: { kind: "closed", reason: "denied" } });
  const reread = await h.raw(asJson("GET", "/api/items", undefined, { cookie: h.graceCookie }));
  expect(reread.status).toBe(403);
  await grace.close();
});

it("hydrates any list the server can answer, and undoes it", async () => {
  await properties(hydrate, { runs: 100, seed: 8 });
});
