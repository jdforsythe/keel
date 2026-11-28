import type { Href } from "@keel/router";
import type { Locale } from "@keel/std-i18n";
import type { Columns } from "./Columns.type.ts";
import type { Field } from "./Field.ts";
import type { TablePage } from "./TablePage.type.ts";
import type { TableQuery } from "./TableQuery.ts";
import type { TableStyles } from "./TableStyles.ts";
import type { TableText } from "./TableText.ts";

type Key = string | number;
/** A shown column whose values are not text or numbers needs its own cell. */
type Needed<T, W extends keyof T> = { [K in W]-?: T[K] extends string | number ? never : K }[W];
type Cells<T, W extends keyof T> = { readonly [K in Needed<T, W>]: (row: T) => Node } & {
  readonly [K in W]?: (row: T) => Node;
};

/** `DataTable`'s props (std.tables DataTable): a client source (`rows`, `pageSize`) or a server source (`page`). */
export type DataTableProps<T, S extends Field<T>, F extends Field<T>, W extends Field<T>> = {
  readonly id: string;
  readonly columns: Columns<T, S, F, W>;
  /** The route's search, parsed by `tableSearch(columns)`. */
  readonly search: TableQuery<T, S, F>;
  /** The table's own route with a new search: sort, pager and filter links. */
  readonly href: (search: TableQuery<T, S, F>) => Href;
  readonly locale: Locale;
  readonly text: TableText<T, W>;
  readonly header?: (col: W, sort: "ascending" | "descending" | undefined) => Node;
  /** Rendered in one cell spanning the row when `total` is 0. */
  readonly empty?: () => Node;
  /** `x` wraps the table, not the pager, in a scroll region named as the table is; read once. */
  readonly scroll?: "x";
  readonly styles?: TableStyles<Extract<W, string>>;
} & (
  | { readonly label: string; readonly labelledBy?: never }
  | { readonly labelledBy: string; readonly label?: never }
) &
  (
    | { readonly rows: () => readonly T[]; readonly pageSize: number; readonly page?: never }
    | { readonly page: TablePage<T>; readonly rows?: never; readonly pageSize?: never }
  ) &
  ([Needed<T, W>] extends [never] ? { readonly cells?: Cells<T, W> } : { readonly cells: Cells<T, W> }) &
  (
    | {
        readonly selected: () => readonly Key[];
        readonly onSelect: (keys: readonly Key[]) => void;
        readonly text: { readonly selectAll: string; readonly selectRow: (row: T) => string };
      }
    | { readonly selected?: never; readonly onSelect?: never }
  ) &
  ({ readonly actions: (row: T) => Node; readonly text: { readonly actions: string } } | { readonly actions?: never });
