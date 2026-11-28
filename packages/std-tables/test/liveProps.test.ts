// @vitest-environment happy-dom
// Props the app changes while the table is mounted update the table in place: nodes, focus and pager are kept.
import type { Ctx } from "@keel/ctx";
import { signal } from "@keel/reactive";
import { s } from "@keel/schema";
import type { Locale } from "@keel/std-i18n";
import { render } from "@keel/testing";
import { Box, Button } from "@keel/ui";
import { expect, test } from "vitest";
import { DataTable } from "../src/DataTable.ts";
import { TableSearch } from "../src/TableSearch.component.ts";
import { CELLS, type Query, TEXT, catalogColumns, makeRows, serverHref, simCtx } from "./support.ts";

const body = (t: ReturnType<typeof render>): string[] => t.a11y("cat.body").children.map((c) => c.id);

let set = (): void => {};
const view = (): Node => {
  const label = signal("Catalog");
  const locale = signal<Locale>("en-US");
  const words = signal("Pages");
  const picked = signal<readonly number[]>([]);
  const n = signal(12);
  const search = signal<Query>({ page: 2 });
  set = () => {
    label.set("Katalog");
    locale.set("de-DE");
    words.set("Seiten");
    picked.set([7]);
    n.set(13);
    search.set({ page: 2, sort: "minutes", dir: "desc" });
  };
  return Box({
    children: () => [
      Button({ id: "go", onClick: () => set(), children: "Change" }),
      DataTable({
        id: "cat",
        get label() {
          return label.get();
        },
        columns: catalogColumns,
        get search() {
          return search.get();
        },
        href: serverHref,
        get locale() {
          return locale.get();
        },
        rows: () => makeRows(n.get()).map((r) => ({ ...r, minutes: r.minutes * 1000 })),
        pageSize: 5,
        selected: () => picked.get(),
        onSelect: (keys) => picked.set(keys.map(Number)),
        get text() {
          return { ...TEXT, pager: words.get(), pageOf: (p: number, ps: number) => `${words.get()} ${p}/${ps}` };
        },
        cells: CELLS,
      }),
    ],
  });
};
const Page = Object.assign((_props: Record<string, never>, _ctx: Ctx): Node => view(), {
  Props: s.object({}),
});

test("label, text, locale, selected, rows and search read from signals update the mounted table", async () => {
  const t = render(Page, { props: {}, ctx: simCtx() });
  expect(t.find("cat.table").name).toBe("Catalog");
  expect(t.find("cat.pager").name).toBe("Pages");
  expect(t.find("cat.status").text).toBe("Pages 2/3");
  expect(t.find("cat.cell.6.minutes").text).toBe("18,000");
  expect(t.find("cat.selectAll").state.checked).toBe(false);
  await t.fire("go", { type: "focus" });
  await t.fire("go", { type: "click" });
  expect(t.find("cat.table").name).toBe("Katalog");
  expect(t.find("cat.pager").name).toBe("Seiten");
  expect(t.find("cat.status").text).toBe("Seiten 2/3");
  expect(t.find("cat.header.minutes").state.sort).toBe("descending");
  expect(t.find("cat.header.title").state.sort).toBeUndefined();
  expect(t.find("cat.table").state.rowcount).toBe(14);
  expect(body(t)).toHaveLength(5);
  const first = body(t)[0] ?? "";
  expect(t.find(`${first.replace("row", "cell")}.minutes`).text).toMatch(/^\d{1,2}\.\d{3}$/); // de-DE grouping
  expect(t.find("cat.select.7").state.checked).toBe(body(t).includes("cat.row.7"));
  expect(t.find("go").state.focused).toBe(true);
  t.dispose();
});

test("TableSearch keeps its input, and the input focus, when the search changes while it is mounted", async () => {
  const Search = Object.assign(
    (_props: Record<string, never>, ctx: Ctx): Node => {
      const q = signal<Query>({ q: "tea" });
      return Box({
        children: () => [
          Button({ id: "set", onClick: () => q.set({ q: "rice" }), children: "Set" }),
          TableSearch(
            {
              id: "find",
              label: "Find",
              get search() {
                return q.get();
              },
              href: serverHref,
            },
            ctx,
          ),
        ],
      });
    },
    { Props: s.object({}) },
  );
  const t = render(Search, { props: {}, ctx: simCtx() });
  await t.fire("find.input", { type: "focus" });
  await t.fire("set", { type: "click" });
  expect(t.find("find.input").state.focused).toBe(true);
  t.dispose();
});

test("TableSearch's label follows a getter label over a signal on the same input", async () => {
  let rename = (): void => {};
  const Find = Object.assign(
    (_props: Record<string, never>, ctx: Ctx): Node => {
      const label = signal("Search recipes");
      rename = () => label.set("Rezepte suchen");
      return Box({
        children: () => [
          Button({ id: "rn", onClick: () => rename(), children: "Rename" }),
          TableSearch(
            {
              id: "find",
              get label() {
                return label.get();
              },
              search: {},
              href: serverHref,
            },
            ctx,
          ),
        ],
      });
    },
    { Props: s.object({}) },
  );
  const t = render(Find, { props: {}, ctx: simCtx() });
  expect(t.find("find.input").name).toBe("Search recipes");
  await t.fire("find.input", { type: "focus" });
  await t.fire("rn", { type: "click" });
  expect(t.find("find.input").state.focused).toBe(true);
  expect(t.find("find.input").name).toBe("Rezepte suchen");
  t.dispose();
});
