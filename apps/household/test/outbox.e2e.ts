// Two members with the list open in two browser contexts: an item one adds shows on the other's page with no reload,
// one buys moves on the other's, a mark made offline waits on its page and goes once the browser is back, a mark of an
// item changed meanwhile comes back refused and is applied on the member's choice, and a sign-out in another tab turns
// the page to Signed out with no new item on it.
import { fixedTime } from "@keel/tooling/test-time";
import { expect, it } from "vitest";
import {
  addStaple,
  household,
  idOf,
  itemsOf,
  json,
  member,
  read,
  rows,
  showBought,
  unexpected,
} from "./householdApp.ts";

it(
  "changes show on the other member's page with no reload, and a mark made offline waits and then goes",
  // The app's own time: the change stream's reconnect after the browser is back (up to 45 s).
  { timeout: fixedTime(120_000) },
  async () => {
    const { served } = await household();
    const ada = await member(served, "Ada Lovelace", "ada@example.com");
    const grace = await member(served, "Grace Hopper", "grace@example.com");
    const loads = (await grace.documents()).length;

    await addStaple(ada, "bread");
    const bread = await idOf(ada, "Bread");
    await grace.until(`shopping.name.${bread}`, { text: /^Bread/ });
    expect((await grace.documents()).length).toBe(loads);

    await grace.fire(`shopping.toggle.${bread}`, { type: "click" });
    await showBought(ada);
    await ada.until(`shopping.toggle.${bread}`, { text: "Back on the list" });

    await addStaple(ada, "apples");
    const apples = await idOf(ada, "Apples");
    await grace.until(`shopping.name.${apples}`, { text: /^Apples/ });
    await grace.offline(true);
    await grace.until("shopping.live", { text: /^Offline/ });
    await grace.fire(`shopping.toggle.${apples}`, { type: "click" });
    await grace.until(`shopping.waiting.${apples}`, { text: /waiting to send/ });
    const held = await itemsOf(await ada.fetch("/api/items", { headers: read }));
    expect(held.find((i) => i.id === apples)?.bought).toBe(false);

    await grace.offline(false);
    await grace.until("shopping.live", { text: /^Live/ }, { fixed: 45_000 });
    await grace.until(`shopping.waiting.${apples}`, { gone: true }, { fixed: 30_000 });
    const sent = await itemsOf(await ada.fetch("/api/items", { headers: read }));
    expect(sent.find((i) => i.id === apples)?.bought).toBe(true);
    expect((await grace.documents()).length).toBe(loads);
    expect(unexpected(grace)).toEqual([]);
    expect(unexpected(ada)).toEqual([]);
  },
);

it(
  "a mark of an item changed at home is shown refused, and the member applies it over the change",
  // The app's own time: the outbox sends again once the browser is back and the change stream is live (up to 30 s).
  { timeout: fixedTime(120_000) },
  async () => {
    const { served } = await household();
    const ada = await member(served, "Ada Lovelace", "ada@example.com");
    const grace = await member(served, "Grace Hopper", "grace@example.com");
    const add = () =>
      ada.fetch("/api/items", { method: "POST", headers: json, body: JSON.stringify({ name: "Oats" }) });
    expect((await add()).status).toBe(200);
    const oats = await idOf(ada, "Oats");
    await grace.until(`shopping.name.${oats}`, { text: /^Oats/ });

    await grace.offline(true);
    await grace.until("shopping.live", { text: /^Offline/ });
    await grace.fire(`shopping.toggle.${oats}`, { type: "click" });
    expect((await add()).status).toBe(200);
    await grace.offline(false);
    await grace.until(
      "shopping.outbox.refused",
      { text: /Oats × 2: someone at home changed this item/ },
      { fixed: 30_000 },
    );
    const before = await itemsOf(await ada.fetch("/api/items", { headers: read }));
    expect(before.find((i) => i.id === oats)?.bought).toBe(false);

    const [mine] = await grace.findAll("shopping.outbox.mine");
    if (mine === undefined) throw new Error("the refused mark offers no way to apply it");
    await grace.fire(mine.id, { type: "click" });
    await grace.until("shopping.outbox.refused", { gone: true }, { fixed: 10_000 });
    const after = await itemsOf(await ada.fetch("/api/items", { headers: read }));
    expect(after.find((i) => i.id === oats)?.bought).toBe(true);
    expect(unexpected(grace)).toEqual([]);
    expect(unexpected(ada)).toEqual([]);
  },
);

it("signed out in another tab, the page says so and gets no new item", async () => {
  const { served } = await household();
  const ada = await member(served, "Ada Lovelace", "ada@example.com");
  const grace = await member(served, "Grace Hopper", "grace@example.com");
  await addStaple(ada, "rice");
  const rice = await idOf(ada, "Rice");
  await grace.until(`shopping.name.${rice}`, { text: "Rice × 1" });

  const elsewhere = await grace.open("/list");
  await elsewhere.fire("app.nav.signOut", { type: "click" });
  expect((await elsewhere.location()).path).toMatch(/^\/signin/);
  // The next change closes her stream as denied: her page says Signed out within about a second of Ada's add.
  await addStaple(ada, "rice");
  await grace.until("shopping.live", { text: /^Signed out/ }, { within: 2_000 });
  expect(await rows(grace)).not.toContain("Rice × 2");
  expect(unexpected(grace)).toEqual([]);
  expect(unexpected(elsewhere)).toEqual([]);
  expect(unexpected(ada)).toEqual([]);
});
