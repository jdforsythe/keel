import { computed } from "@keel/reactive";
import { For, If } from "@keel/runtime-dom";
import { formatNumber } from "@keel/std-i18n";
import { type Child, Link } from "@keel/ui";
import { Part } from "@keel/ui/aria";
import type { DataTableProps } from "./DataTableProps.ts";
import type { Field } from "./Field.ts";
import type { TablePage } from "./TablePage.type.ts";
import type { TableQuery } from "./TableQuery.ts";
import { applyQuery } from "./applyQuery.ts";
import { nextSort } from "./internal/nextSort.ts";
import { untracked } from "./internal/untracked.ts";

type Key = string | number;

/** By table id: the pager link (`next`, `previous`) that had focus, until focus moves elsewhere. */
const pagerFocus = new Map<string, string>();

/** The rows before this page: a page before the last holds `pageSize` rows, so no page size is needed. */
const offset = (v: TablePage<unknown>): number =>
  v.page < v.pages ? (v.page - 1) * v.rows.length : v.total - v.rows.length;

/**
 * A data table (std.tables DataTable): a native `table` of parts with APG Sortable Table semantics. Sort and pager
 * controls are links to `href(search)`; only the sorted column carries `aria-sort`; rows carry their index in the
 * whole result. When a navigation removes the focused pager link, focus moves to the pager's `status`.
 */
export function DataTable<T extends object, S extends Field<T>, F extends Field<T>, W extends Field<T>>(
  props: DataTableProps<T, S, F, W>,
): Node {
  const { id, columns: cols, search, text } = props;
  const styles = props.styles ?? {};
  const view = computed(
    (): TablePage<T> =>
      props.page !== undefined
        ? props.page
        : applyQuery(cols, props.rows(), search, { pageSize: props.pageSize, locale: props.locale }),
  );
  const keyOf = (row: T): Key => {
    const k: unknown = row[cols.key];
    return typeof k === "number" ? k : String(k);
  };
  const sorted: string | undefined =
    search.sort !== undefined && cols.sort.includes(search.sort) ? search.sort : undefined;
  const sortOf = (col: string): "ascending" | "descending" | undefined =>
    col === sorted ? (search.dir === "desc" ? "descending" : "ascending") : undefined;
  const sortable = (col: string): S | undefined => cols.sort.find((c) => c === col);
  const at = (page: number): TableQuery<T, S, F> => {
    const out = { ...search, page };
    if (page === 1) Reflect.deleteProperty(out, "page");
    return out;
  };

  const select = props.onSelect;
  const chosen = computed((): readonly Key[] => props.selected?.() ?? []);
  const isChosen = (k: Key): boolean => chosen.get().some((c) => String(c) === String(k));
  const pageKeys = (): Key[] => view.get().rows.map(keyOf);
  const pageState = computed((): boolean | "mixed" => {
    const keys = pageKeys();
    const n = keys.filter(isChosen).length;
    return n === 0 ? false : n === keys.length ? true : "mixed";
  });
  const toggle = (keys: readonly Key[], on: boolean): void => {
    const had = chosen.get();
    const drop = new Set(keys.map(String));
    const kept = had.filter((k) => !drop.has(String(k)));
    select?.(on ? [...kept, ...keys] : kept);
  };
  const columnCount = cols.show.length + (select ? 1 : 0) + (props.actions ? 1 : 0);

  const content = (row: T, col: W): Child => {
    const own = props.cells?.[col];
    if (own !== undefined) return own(row);
    const v: unknown = row[col];
    return typeof v === "number" ? formatNumber(v, props.locale) : typeof v === "string" ? v : "";
  };
  const headerCell = (col: W): Node => {
    const sort = sortOf(col);
    // The header slot renders once, untracked: its own bindings update it, never the enclosing render.
    const label = (): Child => untracked(() => (props.header ? props.header(col, sort) : text.headers[col]));
    const by = sortable(col);
    return Part({
      ...styles.header,
      id: `${id}.header.${col}`,
      role: "columnheader",
      sort,
      children: () =>
        by === undefined
          ? label()
          : Link({ ...styles.sort, id: `${id}.sort.${col}`, to: props.href(nextSort(search, by)), children: label }),
    });
  };
  const rowOf = (row: T): Node => {
    const key = keyOf(row);
    const index = computed(() => {
      const v = view.get();
      return offset(v) + v.rows.findIndex((r) => keyOf(r) === key) + 2;
    });
    const cells: Node[] = [];
    if (props.selected !== undefined) {
      const name = props.text.selectRow(row);
      cells.push(
        Part({
          ...styles.cell,
          id: `${id}.pick.${key}`,
          role: "cell",
          children: () =>
            Part({
              ...styles.select,
              id: `${id}.select.${key}`,
              role: "checkbox",
              label: name,
              checked: computed(() => isChosen(key)),
              onClick: () => toggle([key], !isChosen(key)),
            }),
        }),
      );
    }
    for (const col of cols.show)
      cells.push(
        Part({
          ...styles.cell,
          id: `${id}.cell.${key}.${col}`,
          role: col === cols.rowHeader ? "rowheader" : "cell",
          children: () => content(row, col),
        }),
      );
    const actions = props.actions;
    if (actions !== undefined)
      cells.push(Part({ ...styles.cell, id: `${id}.actions.${key}`, role: "cell", children: () => actions(row) }));
    return Part({ ...styles.row, id: `${id}.row.${key}`, role: "row", rowIndex: index, children: () => cells });
  };

  const heads: Node[] = [];
  if (props.selected !== undefined)
    heads.push(
      Part({
        ...styles.cell,
        id: `${id}.pick`,
        role: "cell",
        children: () =>
          Part({
            ...styles.selectAll,
            id: `${id}.selectAll`,
            role: "checkbox",
            label: props.text.selectAll,
            checked: pageState,
            onClick: () => toggle(pageKeys(), pageState.get() !== true),
          }),
      }),
    );
  for (const col of cols.show) heads.push(headerCell(col));
  if (props.actions !== undefined)
    heads.push(
      Part({ ...styles.header, id: `${id}.actions`, role: "columnheader", children: () => props.text.actions }),
    );

  const empty = props.empty;
  const body = Part({
    ...styles.body,
    id: `${id}.body`,
    role: "rowgroup",
    children: () =>
      For({
        get each() {
          return view.get().rows;
        },
        key: cols.key,
        children: rowOf,
        ...(empty === undefined
          ? {}
          : {
              empty: () =>
                Part({
                  id: `${id}.empty`,
                  role: "row",
                  children: () =>
                    Part({
                      ...styles.cell,
                      id: `${id}.empty.cell`,
                      role: "cell",
                      colSpan: columnCount,
                      children: empty,
                    }),
                }),
            }),
      }),
  });
  const named = props.labelledBy !== undefined ? { labelledBy: props.labelledBy } : { label: props.label };
  const table = Part({
    ...styles.table,
    ...named,
    id: `${id}.table`,
    role: "table",
    rowCount: computed(() => {
      const v = view.get();
      return v.rows.length < v.total ? v.total + 1 : undefined;
    }),
    children: () => [
      Part({
        ...styles.head,
        id: `${id}.head`,
        role: "rowgroup",
        head: true,
        children: () => Part({ id: `${id}.columns`, role: "row", rowIndex: 1, children: () => heads }),
      }),
      body,
    ],
  });

  const status = Part({
    ...styles.status,
    id: `${id}.status`,
    role: "status",
    tabIndex: -1,
    children: () => computed(() => text.pageOf(view.get().page, view.get().pages)),
  });
  // A pager link focused when the last page was replaced, and missing from this one, hands focus to `status`.
  const was = pagerFocus.get(id);
  pagerFocus.delete(id);
  const v0 = untracked(() => view.get());
  if ((was === "next" && v0.page >= v0.pages) || (was === "previous" && v0.page <= 1))
    queueMicrotask(() => {
      const lost = document.activeElement === null || document.activeElement === document.body;
      if (lost && status instanceof HTMLElement && status.isConnected) status.focus();
    });
  const pager = Part({
    ...styles.pager,
    id: `${id}.pager`,
    role: "navigation",
    label: text.pager,
    children: () => [
      If({
        get when() {
          return view.get().page > 1;
        },
        children: () =>
          Link({
            ...styles.previous,
            id: `${id}.previous`,
            get to() {
              return props.href(at(view.get().page - 1));
            },
            children: text.previous,
          }),
      }),
      status,
      If({
        get when() {
          return view.get().page < view.get().pages;
        },
        children: () =>
          Link({
            ...styles.next,
            id: `${id}.next`,
            get to() {
              return props.href(at(view.get().page + 1));
            },
            children: text.next,
          }),
      }),
    ],
  });
  if (pager instanceof HTMLElement) {
    pager.addEventListener("focusin", (e) => {
      const to = e.target instanceof Element ? e.target.id : "";
      if (to === `${id}.next` || to === `${id}.previous`) pagerFocus.set(id, to.slice(id.length + 1));
    });
    // Focus moving elsewhere forgets the link; a link removed with the page has no next target and is kept.
    pager.addEventListener("focusout", (e) => {
      if (e instanceof FocusEvent && e.relatedTarget !== null) pagerFocus.delete(id);
    });
  }
  return Part({ id, role: "generic", children: () => [table, pager] });
}
