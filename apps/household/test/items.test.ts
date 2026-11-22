import { type Infer, s } from "@keel/schema";
import { expect, it } from "vitest";
import { Items } from "../modules/shopping/Items.schema.ts";
import { asJson, served } from "./serve.ts";

type List = Infer<typeof Items>["items"];

const Listed = s.object({ results: s.object({ "shopping.items": s.object({ ok: s.boolean(), value: Items }) }) });

/** The list as `GET /api/items` answers it. */
async function listed(fetch: (r: Request) => Promise<Response>): Promise<List> {
  const r = Listed.parse(await (await fetch(asJson("GET", "/api/items"))).json());
  return r.ok ? r.value.results["shopping.items"].value.items : [];
}

/** The list's three rules: at most 50 items, unique ids, one open item per name. */
function holds(items: List): boolean {
  const open = items.filter((i) => !i.bought).map((i) => i.name);
  return (
    items.length <= 50 && new Set(items.map((i) => i.id)).size === items.length && new Set(open).size === open.length
  );
}

it("starts empty", async () => {
  const { fetch } = await served(11);
  expect(await listed(fetch)).toEqual([]);
});

it("raises the quantity of a name still to buy and merges a bought one put back", async () => {
  const { fetch } = await served(11);
  await fetch(asJson("POST", "/api/items", { name: "Milk" }));
  await fetch(asJson("POST", "/api/items", { name: "Milk" }));
  const [first] = await listed(fetch);
  expect(first).toMatchObject({ name: "Milk", qty: 2, bought: false });
  if (first === undefined) return;
  await fetch(asJson("POST", `/api/items/${first.id}/toggle`));
  await fetch(asJson("POST", "/api/items", { name: "Milk" }));
  expect((await listed(fetch)).map((i) => [i.name, i.qty, i.bought])).toEqual([
    ["Milk", 2, true],
    ["Milk", 1, false],
  ]);
  await fetch(asJson("POST", `/api/items/${first.id}/toggle`));
  expect((await listed(fetch)).map((i) => [i.name, i.qty, i.bought])).toEqual([["Milk", 3, false]]);
});

it("stops at 50 items", async () => {
  const { fetch } = await served(12);
  for (let n = 0; n < 52; n++) await fetch(asJson("POST", "/api/items", { name: `Item ${n}` }));
  const items = await listed(fetch);
  expect(items).toHaveLength(50);
  expect(items.at(-1)?.name).toBe("Item 49");
});

it("keeps the rules through 80 seeded adds, toggles and removals over three names", async () => {
  const { fetch } = await served(13);
  let seed = 13;
  const pick = (n: number) => {
    seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
    return seed % n;
  };
  const names = ["Milk", "Eggs", "Rice"];
  for (let step = 0; step < 80; step++) {
    const items = await listed(fetch);
    expect(holds(items)).toBe(true);
    const target = items[pick(Math.max(items.length, 1))];
    const move = pick(3);
    if (move === 0 || target === undefined)
      await fetch(asJson("POST", "/api/items", { name: names[pick(names.length)] }));
    else if (move === 1) await fetch(asJson("POST", `/api/items/${target.id}/toggle`));
    else await fetch(asJson("DELETE", `/api/items/${target.id}`));
  }
  expect(holds(await listed(fetch))).toBe(true);
});
