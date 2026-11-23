// std.offline: a write sent offline waits in the outbox and goes once on reconnect; k.data: over app data the app keeps
// its own version and answers `keel.conflict`; std.outbox-owner: a write commits for the member who queued it. Ada
// marks Milk bought with no connection while Grace, at home, changes the list through the API.
import { s } from "@keel/schema";
import { sql } from "@keel/std-postgres";
import { expect, it } from "vitest";
import mount from "../identity.ts";
import { shoppingDb } from "../modules/shopping/shoppingDb.server.ts";
import { household, listPage } from "./household.ts";
import { asJson, formPost } from "./serve.ts";

const click = { type: "click" } as const;
const Count = s.object({ n: s.int() });
type House = Awaited<ReturnType<typeof household>>;

/** The list as the server holds it, read as Grace. */
async function stored(h: House) {
  const res = await h.raw(asJson("GET", "/api/items", undefined, { cookie: h.graceCookie }));
  const list: { id: string; name: string; qty: number; bought: boolean; rev: number }[] = (await res.json()).results[
    "shopping.items"
  ].value.items;
  return list;
}

/** How many outbox writes the server has committed. */
async function committed(h: House): Promise<number> {
  const rows = await shoppingDb(h.ctx).query(sql(Count)`select count(*)::int as n from list_writes`);
  return rows.ok ? (rows.value[0]?.n ?? -1) : -1;
}

/** A household whose list holds Milk, Ada's list page open, the network down, and Milk marked bought on her page. */
async function markedOffline(seed: number) {
  const h = await household(seed);
  await h.raw(asJson("POST", "/api/items", { name: "Milk" }, { cookie: h.graceCookie }));
  const page = await listPage(h, h.user);
  await page.settle();
  const [milk] = await stored(h);
  if (milk === undefined) throw new Error("no Milk on the list");
  h.ctx.net.setOnline(false);
  await page.settle();
  await page.fire(`shopping.toggle.${milk.id}`, click);
  return { h, page, milk };
}

/** The key of the one entry the page's outbox holds. */
function entryKey(page: { state(): Readonly<Record<string, unknown>> }): string {
  const entries: unknown = Reflect.get(Object(page.state()["shopping.outbox"]), "entries");
  return Array.isArray(entries) && entries.length > 0 ? String(Reflect.get(Object(entries[0]), "key")) : "";
}

it("keeps a mark made offline on the page and sends it once when the connection is back", async () => {
  const { h, page, milk } = await markedOffline(81);
  expect(page.find(`shopping.waiting.${milk.id}`).text).toBe("Bought, waiting to send");
  expect(page.find(`shopping.waiting.${milk.id}`).role).toBe("status");
  expect(page.find("shopping.live").text).toContain("Offline");
  expect(await stored(h)).toMatchObject([{ name: "Milk", bought: false, rev: 0 }]);
  expect(await committed(h)).toBe(0);

  h.ctx.net.setOnline(true);
  await page.settle();
  expect(await stored(h)).toMatchObject([{ name: "Milk", bought: true, rev: 1 }]);
  expect(await committed(h)).toBe(1);
  expect(page.find(`shopping.waiting.${milk.id}`).text).toBe("");
  expect(page.find(`shopping.toggle.${milk.id}`).text).toBe("Back on the list");
  expect(entryKey(page)).toBe("");
  page.dispose();
});

it("shows a mark the server refused because the item changed at home, and applies it when the member says so", async () => {
  const { h, page, milk } = await markedOffline(82);
  await h.raw(asJson("POST", "/api/items", { name: "Milk" }, { cookie: h.graceCookie }));
  h.ctx.net.setOnline(true);
  await page.settle();
  const key = entryKey(page);
  expect(page.find(`shopping.outbox.why.${key}`).text).toBe(
    "Milk × 2: someone at home changed this item while your mark waited",
  );
  expect(page.find(`shopping.outbox.why.${key}`).role).toBe("alert");
  expect(await stored(h)).toMatchObject([{ name: "Milk", qty: 2, bought: false, rev: 1 }]);
  expect(await committed(h)).toBe(0);

  await page.fire(`shopping.outbox.mine.${key}`, click);
  expect(await stored(h)).toMatchObject([{ name: "Milk", qty: 2, bought: true, rev: 2 }]);
  expect(await committed(h)).toBe(1);
  expect(entryKey(page)).toBe("");
  expect(page.find(`shopping.toggle.${milk.id}`).text).toBe("Back on the list");
  page.dispose();
});

it("leaves the item as it is at home when the member says so", async () => {
  const { h, page } = await markedOffline(83);
  await h.raw(asJson("POST", "/api/items", { name: "Milk" }, { cookie: h.graceCookie }));
  h.ctx.net.setOnline(true);
  await page.settle();
  await page.fire(`shopping.outbox.theirs.${entryKey(page)}`, click);
  expect(entryKey(page)).toBe("");
  expect(await stored(h)).toMatchObject([{ name: "Milk", qty: 2, bought: false, rev: 1 }]);
  expect(await committed(h)).toBe(0);
  page.dispose();
});

it("says so when the item was removed at home, and the member dismisses the mark", async () => {
  const { h, page, milk } = await markedOffline(84);
  await h.raw(asJson("DELETE", `/api/items/${milk.id}`, undefined, { cookie: h.graceCookie }));
  h.ctx.net.setOnline(true);
  await page.settle();
  const key = entryKey(page);
  expect(page.find(`shopping.outbox.why.${key}`).text).toBe("An item: this item is no longer on the list");
  await page.fire(`shopping.outbox.theirs.${key}`, click);
  expect(entryKey(page)).toBe("");
  expect(await stored(h)).toEqual([]);
  page.dispose();
});

it("commits a write sent twice once, and refuses a write for another member, for no one, or with no owner", async () => {
  const h = await household(85);
  await h.raw(asJson("POST", "/api/items", { name: "Milk" }, { cookie: h.graceCookie }));
  const [milk] = await stored(h);
  const mark = (owner: string, cookie: string, key = "Write_one") =>
    h.raw(
      asJson(
        "POST",
        `/api/items/${milk?.id}/bought`,
        { bought: true, write: { key, base: 0, owner } },
        cookie === "" ? {} : { cookie },
      ),
    );
  const code = async (res: Response) => (await res.json()).error?.code;

  const other = await mark(h.user, h.graceCookie);
  expect([other.status, await code(other)]).toEqual([400, "offline.owner"]);
  const signedOut = await mark(h.user, "");
  expect([signedOut.status, await code(signedOut)]).toEqual([400, "offline.signin"]);
  const noOne = await mark("", "");
  expect([noOne.status, await code(noOne)]).toEqual([403, "keel.denied"]);
  expect(await stored(h)).toMatchObject([{ bought: false, rev: 0 }]);

  expect((await mark(h.user, h.adaCookie)).status).toBe(200);
  expect((await mark(h.user, h.adaCookie)).status).toBe(200);
  expect(await stored(h)).toMatchObject([{ bought: true, rev: 1 }]);
  expect(await committed(h)).toBe(1);
  const stale = await mark(h.user, h.adaCookie, "Write_two");
  expect(stale.status).toBe(409);
  expect((await stale.json()).error).toMatchObject({
    code: "keel.conflict",
    data: { transaction: "shopping.mark", head: 1 },
  });

  await h.raw(formPost(mount.href("/sign-out"), {}, h.adaCookie));
  const after = await mark(h.user, h.adaCookie, "Write_three");
  expect([after.status, await code(after)]).toEqual([400, "offline.signin"]);
});

it("keeps a write key to the member who sent it: two members' marks with one key both apply, one member's twice once", async () => {
  const h = await household(86);
  await h.raw(asJson("POST", "/api/items", { name: "Milk" }, { cookie: h.graceCookie }));
  await h.raw(asJson("POST", "/api/items", { name: "Eggs" }, { cookie: h.graceCookie }));
  const items = await stored(h);
  const [first, second] = items;
  if (first === undefined || second === undefined) throw new Error("the list holds fewer than two items");
  const mark = (id: string, owner: string, cookie: string) =>
    h.raw(
      asJson("POST", `/api/items/${id}/bought`, { bought: true, write: { key: "Write_shared", base: 0, owner } }, { cookie }),
    );

  expect((await mark(first.id, h.user, h.adaCookie)).status).toBe(200);
  expect((await mark(second.id, h.graceId, h.graceCookie)).status).toBe(200);
  expect((await stored(h)).map((i) => [i.id, i.bought, i.rev])).toEqual(items.map((i) => [i.id, true, 1]));
  expect(await committed(h)).toBe(2);

  expect((await mark(first.id, h.user, h.adaCookie)).status).toBe(200);
  expect((await mark(second.id, h.graceId, h.graceCookie)).status).toBe(200);
  expect((await stored(h)).map((i) => i.rev)).toEqual([1, 1]);
  expect(await committed(h)).toBe(2);
});
