import { computed, effect } from "@keel/reactive";
import { For, If } from "@keel/runtime-dom";
import { formatNumber } from "@keel/std-i18n";
import { Box, type Child, Link } from "@keel/ui";
import { Part, type PartStyle } from "@keel/ui/aria";
import type { DataTableProps } from "./DataTableProps.ts";
import type { TableStyles } from "./TableStyles.ts";
import type { Field } from "./Field.ts";
import type { TablePage } from "./TablePage.type.ts";
import type { TableQuery } from "./TableQuery.ts";
import { applyQuery } from "./applyQuery.ts";
import { checkKeys } from "./internal/checkKeys.ts";
import { nextSort } from "./internal/nextSort.ts";

type Key = string | number;

/** The rows before this page: a page before the last holds `pageSize` rows, so no page size is needed. */
const offset = (v: TablePage<unknown>): number =>
  v.page < v.pages ? (v.page - 1) * v.rows.length : v.total - v.rows.length;

/**
 * A data table (std.tables DataTable): a native `table` of parts with APG Sortable Table semantics. Sort and pager
 * controls are links to `href(search)`; only the sorted column carries `aria-sort`; rows carry their index in the
 * whole result. When a navigation removes the focused pager link, focus moves to the pager's `status`. Each part is
 * made inside its container's `children` thunk, in document order (head before body, the pager's links and status in
 * their places), so a served table resumes in place.
 */
export function DataTable<T extends object, S extends Field<T>, F extends Field<T>, W extends Field<T>>(
  props: DataTableProps<T, S, F, W>,
): Node {
  // Read once: `id`, `columns`, `styles`, and whether `selected`, `actions` and `labelledBy` are given (they shape the
  // table). Everything else is read where it is shown, so a prop the app changes updates the table in place.
  const { id, columns: cols } = props;
  const styles: TableStyles = props.styles ?? {};
  for (const key of Object.keys(styles))
    if (key.startsWith("column.") && !cols.show.some((c) => c === key.slice(7)))
      throw new Error(`E2851 styles key ${JSON.stringify(key.slice(0, 40))} names no shown column`);
  const columnStyle = (col: string): PartStyle => styles[`column.${col}`] ?? {};
  const text = () => props.text;
  const view = computed(
    (): TablePage<T> =>
      props.page !== undefined
        ? checked(props.page)
        : applyQuery(cols, props.rows(), props.search, { pageSize: props.pageSize, locale: props.locale }),
  );
  const checked = (page: TablePage<T>): TablePage<T> => {
    checkKeys(page.rows.map((row) => row[cols.key]));
    return page;
  };
  const keyOf = (row: T): Key => {
    const k: unknown = row[cols.key];
    return typeof k === "number" ? k : String(k);
  };
  const sorted = computed((): string | undefined => {
    const by = props.search.sort;
    return by !== undefined && cols.sort.includes(by) ? by : undefined;
  });
  const sortOf = (col: string): "ascending" | "descending" | undefined =>
    col === sorted.get() ? (props.search.dir === "desc" ? "descending" : "ascending") : undefined;
  const sortable = (col: string): S | undefined => cols.sort.find((c) => c === col);
  const at = (page: number): TableQuery<T, S, F> => {
    const out = { ...props.search, page };
    if (page === 1) Reflect.deleteProperty(out, "page");
    return out;
  };

  // `selected` makes the table selectable; the types require `onSelect` with it.
  const select = props.selected !== undefined;
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
    props.onSelect?.(on ? [...kept, ...keys] : kept);
  };
  const columnCount = cols.show.length + (select ? 1 : 0) + (props.actions ? 1 : 0);

  const content = (row: T, col: W): Child => {
    const own = props.cells?.[col];
    if (own !== undefined) return own(row);
    const v: unknown = row[col];
    return typeof v === "number" ? computed(() => formatNumber(v, props.locale)) : typeof v === "string" ? v : "";
  };
  const headerCell = (col: W): Node => {
    const sort = computed(() => sortOf(col));
    // The header slot renders anew when this column's sort changes (a `For` row keyed by it); text is bound.
    const label = (): Child => {
      const header = props.header;
      if (header === undefined) return computed(() => text().headers[col]);
      return For({
        get each() {
          return [{ sort: sort.get() ?? "none" }];
        },
        key: "sort",
        children: () => header(col, sort.get()),
      });
    };
    const by = sortable(col);
    return Part({
      ...styles.header,
      ...columnStyle(col),
      id: `${id}.header.${col}`,
      role: "columnheader",
      sort,
      children: () =>
        by === undefined
          ? label()
          : Link({
              ...styles.sort,
              id: `${id}.sort.${col}`,
              get to() {
                return props.href(nextSort(props.search, by));
              },
              children: label,
            }),
    });
  };
  const rowOf = (row: T): Node => {
    const key = keyOf(row);
    const index = computed(() => {
      const v = view.get();
      return offset(v) + v.rows.findIndex((r) => keyOf(r) === key) + 2;
    });
    const actions = props.actions;
    const cells = (): Node[] => {
      const out: Node[] = [];
      if (select) {
        const name = computed(() => (props.selected === undefined ? "" : props.text.selectRow(row)));
        out.push(
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
        out.push(
          Part({
            ...styles.cell,
            ...columnStyle(col),
            id: `${id}.cell.${key}.${col}`,
            role: col === cols.rowHeader ? "rowheader" : "cell",
            children: () => content(row, col),
          }),
        );
      if (actions !== undefined)
        out.push(Part({ ...styles.cell, id: `${id}.actions.${key}`, role: "cell", children: () => actions(row) }));
      return out;
    };
    return Part({ ...styles.row, id: `${id}.row.${key}`, role: "row", rowIndex: index, children: cells });
  };

  const heads = (): Node[] => {
    const out: Node[] = [];
    if (select)
      out.push(
        Part({
          ...styles.cell,
          id: `${id}.pick`,
          role: "cell",
          children: () =>
            Part({
              ...styles.selectAll,
              id: `${id}.selectAll`,
              role: "checkbox",
              label: computed(() => (props.selected === undefined ? "" : props.text.selectAll)),
              checked: pageState,
              onClick: () => toggle(pageKeys(), pageState.get() !== true),
            }),
        }),
      );
    for (const col of cols.show) out.push(headerCell(col));
    if (props.actions !== undefined)
      out.push(
        Part({
          ...styles.header,
          id: `${id}.actions`,
          role: "columnheader",
          children: () => computed(() => (props.actions === undefined ? "" : props.text.actions)),
        }),
      );
    return out;
  };

  const empty = props.empty;
  const body = (): Node =>
    Part({
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
  const named =
    props.labelledBy !== undefined
      ? { labelledBy: computed(() => props.labelledBy ?? "") }
      : { label: computed(() => props.label ?? "") };
  const table = (): Node =>
    Part({
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
          children: () => Part({ id: `${id}.columns`, role: "row", rowIndex: 1, children: heads }),
        }),
        body(),
      ],
    });

  // The pager's `status`, once made: focus moves to it when a new page removes the focused pager link.
  const made: { status: Node | null } = { status: null };
  const status = (): Node => {
    made.status = Part({
      ...styles.status,
      id: `${id}.status`,
      role: "status",
      tabIndex: -1,
      children: () => computed(() => text().pageOf(view.get().page, view.get().pages)),
    });
    return made.status;
  };
  // The pager link (`next`, `previous`) that has focus, until focus moves on; when a new page removes it, `status`
  // takes focus, once.
  let was = "";
  effect(() => {
    const v = view.get();
    if ((was === "next" && v.page >= v.pages) || (was === "previous" && v.page <= 1)) {
      was = "";
      queueMicrotask(() => {
        const lost = document.activeElement === null || document.activeElement === document.body;
        const s = made.status;
        if (lost && s instanceof HTMLElement && s.isConnected) s.focus();
      });
    }
  });
  const pager = (): Node => {
    const nav = Part({
      ...styles.pager,
      id: `${id}.pager`,
      role: "navigation",
      label: computed(() => text().pager),
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
              children: () => computed(() => text().previous),
            }),
        }),
        status(),
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
              children: () => computed(() => text().next),
            }),
        }),
      ],
    });
    if (nav instanceof HTMLElement) {
      nav.addEventListener("focusin", (e) => {
        const to = e.target instanceof Element ? e.target.id : "";
        if (to === `${id}.next` || to === `${id}.previous`) was = to.slice(id.length + 1);
      });
      // Focus leaving the link forgets it, unless the page change is removing the link itself (the handoff's case).
      nav.addEventListener("focusout", (e) => {
        const from = e.target;
        queueMicrotask(() => {
          if (from instanceof Element && from.isConnected) was = "";
        });
      });
    }
    return nav;
  };
  const scroll = props.scroll === "x";
  const region = (): Node => {
    const { scroll: own } = styles;
    const children = (): Node => table();
    return props.labelledBy !== undefined
      ? Box({ ...own, id: `${id}.scroll`, scroll: "x", labelledBy: props.labelledBy, children })
      : Box({ ...own, id: `${id}.scroll`, scroll: "x", label: props.label ?? "", children });
  };
  return Part({ id, role: "generic", children: () => [scroll ? region() : table(), pager()] });
}
