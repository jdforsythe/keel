// Helpers the std.tables tests share: the catalog columns and rows, its routes over a server loader, and readers. Seed 1337.
import { createCtx } from "@keel/ctx";
import { type Href, type RouteProps, loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { type Infer, ok, s } from "@keel/schema";
import { DataTable, TableSearch, applyQuery, columns, tablePage, tableSearch } from "@keel/std-tables";
import { Box, Text } from "@keel/ui";

export const SEED = 1337;
export const LOCALE = "en-US";
export const PAGE_SIZE = 5;

export const simCtx = () => createCtx({ mode: "sim", seed: SEED });

export const CURRENCIES = ["USD", "EUR", "GBP"] as const;
export const CatalogRow = s.object({
  id: s.int({ min: 1 }),
  title: s.string(),
  price: s.object({ minor: s.int({ min: 0 }) }),
  minutes: s.int({ min: 0, max: 600 }),
  added: s.string(),
  currency: s.enum(CURRENCIES),
  favorite: s.boolean(),
});
export type Row = Infer<typeof CatalogRow>;

export const catalogColumns = columns(CatalogRow, {
  key: "id",
  rowHeader: "title",
  show: ["title", "price", "minutes", "added", "favorite"],
  sort: ["title", "price", "minutes", "added"],
  search: ["title"],
  filter: ["currency", "favorite"],
  compare: { price: (a, b) => a.minor - b.minor },
});

export const Search = tableSearch(catalogColumns);
export type Query = Infer<typeof Search>;

/** `n` rows with ids 1..n, distinct lowercase titles, and varied prices, minutes, months, currencies and favorites. */
export const makeRows = (n: number): Row[] =>
  Array.from({ length: n }, (_, i) => {
    const id = i + 1;
    return {
      id,
      title: `item ${String.fromCharCode(97 + ((id * 7) % 26))}${id}`,
      price: { minor: (id * 37) % 101 },
      minutes: (id * 13) % 60,
      added: `2024-${String(1 + (id % 12)).padStart(2, "0")}-01`,
      currency: CURRENCIES[id % 3] ?? "USD",
      favorite: id % 2 === 0,
    };
  });

/** What the server route's loader pages over; a test sets `rows` and reads `loads` (one per navigation). */
export const dataset: { rows: readonly Row[]; loads: number } = { rows: makeRows(12), loads: 0 };
export const useRows = (n: number): void => {
  dataset.rows = makeRows(n);
  dataset.loads = 0;
};

export const TEXT = {
  headers: { title: "Title", price: "Price", minutes: "Minutes", added: "Added", favorite: "Favorite" },
  pager: "Pages",
  previous: "Previous",
  next: "Next",
  pageOf: (page: number, pages: number) => `Page ${page} of ${pages}`,
  selectAll: "Select all rows",
  selectRow: (row: Row) => `Select ${row.title}`,
};
export const CELLS = {
  price: (row: Row): Node => Text({ children: `${row.price.minor} ${row.currency}` }),
  favorite: (row: Row): Node => Text({ children: row.favorite ? "Yes" : "No" }),
};

const Out = s.object({ page: tablePage(CatalogRow) });
const stub = (): Node => Text({ children: "link target" });
export const tbl = contract("tbl", {
  "tbl.server": { path: "/catalog", params: s.object({}), search: Search },
  "tbl.find": { path: "/find", params: s.object({}), search: Search },
});
export const serverHref = (q: Query): Href => tbl.href("tbl.server", {}, q);
export const findHref = (q: Query): Href => tbl.href("tbl.find", {}, q);

export const queryOf = (raw: unknown): Query => {
  const r = Search.parse(raw);
  if (!r.ok) throw new Error("fixture: route search does not parse");
  return r.value;
};
const pageOf = (raw: unknown): Infer<typeof Out>["page"] => {
  const r = Out.parse(raw);
  if (!r.ok) throw new Error("fixture: loader data does not parse");
  return r.value.page;
};

const tableLoader = <I extends "tbl.server" | "tbl.find">(id: I) =>
  loader(tbl, id, { output: Out }, async ({ search }) => {
    dataset.loads += 1;
    return ok({ page: applyQuery(catalogColumns, dataset.rows, search, { pageSize: PAGE_SIZE, locale: LOCALE }) });
  });

const catalog = (props: RouteProps, href: (q: Query) => Href): Node =>
  DataTable({
    id: "cat",
    label: "Catalog",
    columns: catalogColumns,
    // Accessors, not values: a read at the top of the page body would freeze at build (k.component Build).
    get search() {
      return queryOf(props.search);
    },
    href,
    locale: LOCALE,
    get page() {
      return pageOf(props.data);
    },
    text: TEXT,
    cells: CELLS,
  });

export const routes = manifest(tbl, {
  "tbl.server": {
    loader: tableLoader("tbl.server"),
    component: (props) => catalog(props, serverHref),
  },
  "tbl.find": {
    loader: tableLoader("tbl.find"),
    component: (props, ctx) =>
      Box({
        id: "find.page",
        children: () => [
          TableSearch(
            {
              id: "find",
              label: "Search the catalog",
              get search() {
                return queryOf(props.search);
              },
              href: findHref,
            },
            ctx,
          ),
          catalog(props, findHref),
        ],
      }),
  },
});

export const focusedId = (): string => document.activeElement?.id ?? "";

/** The rule code a throwing call reports, from its message or `code`; undefined when it does not throw. */
export const throwsCode = (fn: () => unknown): string | undefined => {
  try {
    fn();
    return undefined;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const fromMessage = /E\d{4}/.exec(message)?.[0];
    if (fromMessage !== undefined) return fromMessage;
    return typeof e === "object" && e !== null && "code" in e && typeof e.code === "string" ? e.code : "no-code";
  }
};

/** Rows ordered the way the spec orders them for `sort` ascending: by `cmp`, ties by `id` ascending. */
export const ordered = (rows: readonly Row[], cmp: (a: Row, b: Row) => number, desc = false): Row[] =>
  [...rows].sort((a, b) => (desc ? -1 : 1) * cmp(a, b) || a.id - b.id);
export const byPrice = (a: Row, b: Row): number => a.price.minor - b.price.minor;

/** A row with this key and title, other fields fixed. */
export const rowWith = (id: number, title: string): Row => ({
  id,
  title,
  price: { minor: id },
  minutes: id,
  added: "2024-01-01",
  currency: "USD",
  favorite: false,
});
