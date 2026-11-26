import { createCtx } from "@keel/ctx";
import { gen } from "@keel/schema/gen";
import { properties, render, renderRoute } from "@keel/testing";
import { testTime } from "@keel/tooling/test-time";
import fc from "fast-check";
import { afterEach, expect, it } from "vitest";
import { app } from "../modules/app/app.contract.ts";
import { members } from "../modules/members/members.contract.ts";
import { Item } from "../modules/shopping/Item.schema.ts";
import ListPage, { Props as ListPageProps } from "../modules/shopping/ListPage.tsx";
import OutboxNote from "../modules/shopping/OutboxNote.tsx";
import RestockPanel from "../modules/shopping/RestockPanel.tsx";
import ShoppingList from "../modules/shopping/ShoppingList.tsx";
import { copy } from "../modules/shopping/copy.store.ts";
import { hydrateRuns } from "../modules/shopping/hydrateRuns.transaction.ts";
import { restockText } from "../modules/shopping/restockText.ts";
import { runsCopy } from "../modules/shopping/runsCopy.store.ts";
import { view } from "../modules/shopping/view.store.ts";
import { SEED } from "./schemas.ts";
import { served, webRoutes } from "./serve.ts";

const click = { type: "click" } as const;
const viewBase = view.snapshot();
const copyBase = copy.snapshot();
const runsBase = runsCopy.snapshot();
afterEach(() => {
  expect(view.restore(viewBase).ok && copy.restore(copyBase).ok && runsCopy.restore(runsBase).ok).toBe(true);
});

const listFor = async (seed: number) => {
  const at = await served(seed);
  const page = await renderRoute("shopping.list", {
    routes: webRoutes,
    params: {},
    ctx: at.ctx,
    app: at.app,
    user: at.user,
  });
  return { ...at, page };
};

it("names the page's landmarks and its one live status line, before any change", async () => {
  const { page } = await listFor(180);
  expect(page.find("frame.nav")).toMatchObject({ role: "navigation", name: "Main" });
  expect(page.find("shopping.heading")).toMatchObject({ role: "heading", name: "Shopping list" });
  expect(page.find("shopping.live")).toMatchObject({ role: "status" });
  expect(page.find("shopping.live").text).toMatch(/^(Live|Connecting):/);
  expect(page.find("shopping.view.tab.bought").state).toMatchObject({ selected: false });
  expect(page.find("app.nav.list").name).toBe("List");
  page.dispose();
});

it("adds staples from the menu, shows them in To buy, and moves one to Bought and back", async () => {
  const { page } = await listFor(181);
  for (const staple of ["bread", "bread", "eggs"]) {
    await page.fire("shopping.staples.trigger", click);
    await page.fire(`shopping.staples.item.${staple}`, click);
  }
  const names = () =>
    page
      .a11y()
      .flatMap(function walk(n): string[] {
        return [n.id, ...n.children.flatMap(walk)];
      })
      .filter((id) => id.startsWith("shopping.name."));
  const [bread, eggs] = names();
  if (bread === undefined || eggs === undefined) throw new Error("the list shows fewer than two items");
  expect(page.find(bread).text).toBe("Bread × 2");
  expect(page.find(eggs).text).toBe("Eggs × 1");
  await page.fire(`shopping.toggle.${eggs.slice("shopping.name.".length)}`, click);
  expect(names()).toEqual([bread]);
  await page.fire(`shopping.remove.${bread.slice("shopping.name.".length)}`, click);
  expect(names()).toEqual([]);
  await page.fire("shopping.view.tab.bought", click);
  expect(page.find(eggs).text).toBe("Eggs × 1");
  await page.fire(`shopping.remove.${eggs.slice("shopping.name.".length)}`, click);
  expect(page.find("shopping.empty").text).toContain("The list is empty");
  page.dispose();
});

it("says so when an add did not reach the server, until the member dismisses it", async () => {
  const { page, ctx } = await listFor(182);
  ctx.net.setOnline(false);
  await page.settle();
  expect(page.find("shopping.live").text).toMatch(/^Offline:/);
  await page.fire("shopping.staples.trigger", click);
  await page.fire("shopping.staples.item.milk", click);
  expect(page.find("shopping.notices.toast.failed").text).toContain("That change did not apply");
  expect(page.find("shopping.empty").text).toContain("The list is empty");
  await page.fire("shopping.notices.dismiss.failed", click);
  expect(
    page.a11y().flatMap(function w(n): string[] {
      return [n.id, ...n.children.flatMap(w)];
    }),
  ).not.toContain("shopping.notices.toast.failed");
  page.dispose();
});

it("shows the weekly staples panel on the setup page: no run yet, then Run now starts one, shown as running", async () => {
  const at = await served(183);
  const page = await renderRoute("setup.form", {
    routes: webRoutes,
    params: {},
    ctx: at.ctx,
    app: at.app,
    user: at.user,
  });
  expect(page.find("shopping.restock.heading")).toMatchObject({ role: "heading", name: "Weekly staples" });
  expect(page.find("shopping.restock.last")).toMatchObject({ role: "status", text: restockText.never });
  expect(page.find("shopping.restock.run")).toMatchObject({ role: "button", name: "Run now" });
  expect(page.find("shopping.restock.refused")).toMatchObject({ role: "alert", text: "" });
  await page.fire("shopping.restock.run", click);
  expect(page.find("shopping.restock.last").text).toMatch(/^Running: \d of 5 staples handled, \d put back\.$/);
  expect(page.find("shopping.restock.started").text).toMatch(/^Started by a member, .* UTC$/);
  expect(runsCopy.get("runs").kept).toBe(1);
  page.dispose();
});

it("says the run did not start when the server cannot be reached", async () => {
  const at = await served(184);
  const page = await renderRoute("setup.form", {
    routes: webRoutes,
    params: {},
    ctx: at.ctx,
    app: at.app,
    user: at.user,
  });
  at.ctx.net.setOnline(false);
  await page.settle();
  await page.fire("shopping.restock.run", click);
  expect(page.find("shopping.restock.refused").text).toBe(restockText.refused);
  expect(page.find("shopping.restock.last").text).toBe(restockText.never);
  page.dispose();
});

it("sets the runs the panel shows from what the server answered, and undoes it", async () => {
  await properties(hydrateRuns, { runs: 100, seed: 9 });
});

const idOf = (n: number) => {
  const r = Item.parse({ id: `item-${n}`, name: "x", qty: 1, bought: false, rev: 0 });
  if (!r.ok) throw new Error("no id");
  return r.value.id;
};

const LIST_RUNS = 50;
/** One run renders the list page and the list and reads them: 20 ms alone. The bound is 1,000 ms a run: 50 times the work alone, which a runner ten times slower (scale 0.1) cuts to 100 ms, five times the work, beside the machine's other workers. */
const LIST_RUN_MS = 1_000;

it(
  "renders the list page and the list for any copy and any items, each with an id as the server mints them",
  () => {
    // `properties` hands an item an id such as `" `, which no server mints and no CSS selector can address.
    const ctx = createCtx({ mode: "sim", seed: 45 });
    fc.assert(
      fc.property(gen(ListPageProps), (props) => {
        const keys = new Set<string>();
        const staples = props.data.text.staples.filter((s) => !keys.has(s.key) && keys.add(s.key));
        const data = {
          ...props.data,
          text: { ...props.data.text, staples },
          items: props.data.items.map((item, n) => ({ ...item, id: idOf(n) })),
        };
        const page = render(ListPage, { props: { data }, ctx });
        try {
          expect(page.find("shopping.heading").text.trim()).toBe(data.text.heading.trim());
          expect(page.focusOrder().filter((id) => id.startsWith("shopping.toggle."))).toHaveLength(
            data.items.filter((i) => !i.bought).length,
          );
        } finally {
          page.dispose();
        }
        const board = render(ShoppingList, { props: { text: data.text, items: data.items, member: data.member }, ctx });
        try {
          expect(board.find("shopping.live").role).toBe("status");
        } finally {
          board.dispose();
        }
      }),
      { numRuns: LIST_RUNS, seed: SEED },
    );
  },
  LIST_RUNS * testTime(LIST_RUN_MS),
);

it("renders the outbox note and the weekly panel for any copy and items the schemas allow", async () => {
  await properties(OutboxNote, { runs: 50, seed: 43 });
  await properties(RestockPanel, { runs: 50, seed: 44 });
});

it("links the start page and the sign-in pages through the contracts, with the search kept", () => {
  expect(app.href("app.start")).toBe("/");
  expect(members.href("members.signin")).toBe("/signin");
  expect(members.href("members.signin", {}, { next: "/list", error: "invalid" })).toBe(
    "/signin?error=invalid&next=%2Flist",
  );
});
