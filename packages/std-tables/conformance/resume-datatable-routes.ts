// The routes module of the packaged-table suite (not a test file). The test imports it for the server side; `resumeDocument`
// imports it again for the client side, where every module it reaches is evaluated anew, its stores included.
import { scope } from "@keel/reactive";
import { type Href, type RouteProps, loader, manifest } from "@keel/router";
import { type Infer, ok, s } from "@keel/schema";
import { DataTable, TableSearch, applyQuery, tablePage } from "@keel/std-tables";
import { type Store, store, transaction, tx } from "@keel/store";
import { Box, Button, Text } from "@keel/ui";
import {
  CELLS,
  CatalogRow,
  LOCALE,
  PAGE_SIZE,
  type Query,
  Search,
  TEXT,
  catalogColumns,
  makeRows,
  queryOf,
} from "./fixtures.ts";

const Rows = s.object({ rows: s.array(CatalogRow) });
const Picked = s.object({ keys: s.array(s.int()) });
const Typed = s.object({ q: s.string() });

function made<T>(make: () => Store<T>): Store<T> {
  let out: Store<T> | undefined;
  scope(() => {
    out = make();
  });
  if (out === undefined) throw new Error("fixture: store scope did not run");
  return out;
}

const rows = made(() => store(Rows, { rows: makeRows(12) }, { id: "dt.rows" }));
const picked = made(() => store(Picked, { keys: [] }, { id: "dt.picked" }));
const typed = made(() => store(Typed, { q: "none" }, { id: "dt.typed" }));
const pick = transaction(picked, "dt.pick", Picked, (_state, payload) => payload);
const type = transaction(typed, "dt.type", Typed, (_state, payload) => payload);

const stub = (): Node => Text({ children: "target" });
const links = manifest({
  "dtc.page": { path: "/dtc", params: s.object({}), search: Search, component: stub },
  "dts.page": { path: "/dts", params: s.object({}), search: Search, component: stub },
  "dtf.page": { path: "/dtf", params: s.object({}), search: Search, component: stub },
});
const clientHref = (q: Query): Href => links.href("dtc.page", {}, q);
const serverHref = (q: Query): Href => links.href("dts.page", {}, q);
const findHref = (q: Query): Href => {
  void tx(type, { q: q.q ?? "" });
  return links.href("dtf.page", {}, q);
};

const Out = s.object({ page: tablePage(CatalogRow) });
const pageOf = (raw: unknown): Infer<typeof Out>["page"] => {
  const r = Out.parse(raw);
  if (!r.ok) throw new Error("fixture: loader data does not parse");
  return r.value.page;
};
const dataLoader = loader({ output: Out, search: Search }, ({ search }) =>
  Promise.resolve(
    ok({ page: applyQuery(catalogColumns, makeRows(12), search, { pageSize: PAGE_SIZE, locale: LOCALE }) }),
  ),
);

/** The client source: rows from a store, `pageSize` 5, `selected`, `onSelect` and `actions` given. */
function clientPage(props: RouteProps): Node {
  picked.uses([pick]);
  return DataTable({
    id: "cat",
    label: "Catalog",
    columns: catalogColumns,
    get search() {
      return queryOf(props.search);
    },
    href: clientHref,
    locale: LOCALE,
    rows: () => rows.get("rows"),
    pageSize: PAGE_SIZE,
    selected: () => picked.get("keys"),
    onSelect: (keys) => void tx(pick, { keys: [...keys].map(Number) }),
    text: { ...TEXT, actions: "Actions" },
    cells: CELLS,
    actions: (row) => Button({ id: `cat.act.${row.id}`, onClick: () => undefined, children: `Edit ${row.id}` }),
  });
}

/** The server source: `page` from a loader. */
function serverPage(props: RouteProps): Node {
  return DataTable({
    id: "cat",
    label: "Catalog",
    columns: catalogColumns,
    get search() {
      return queryOf(props.search);
    },
    href: serverHref,
    locale: LOCALE,
    get page() {
      return pageOf(props.data);
    },
    text: TEXT,
    cells: CELLS,
  });
}

/** `TableSearch` above a table. */
function findPage(props: RouteProps): Node {
  typed.uses([type]);
  return Box({
    id: "find.page",
    children: () => [
      TableSearch({
        id: "find",
        label: "Search the catalog",
        get search() {
          return queryOf(props.search);
        },
        href: findHref,
      }),
      serverPage(props),
    ],
  });
}

export const routes = manifest({
  "dtc.page": { path: "/dtc", params: s.object({}), search: Search, component: clientPage },
  "dts.page": { path: "/dts", params: s.object({}), search: Search, loader: dataLoader, component: serverPage },
  "dtf.page": { path: "/dtf", params: s.object({}), search: Search, loader: dataLoader, component: findPage },
});

export const MODULES = ["dtc", "dts", "dtf"];

export default routes;
