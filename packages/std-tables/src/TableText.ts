/** The words a `DataTable` shows or announces, from the app's message set (std.tables DataTable). */
export type TableText<T, W extends string> = {
  /** One per shown column. */
  readonly headers: { readonly [K in W]: string };
  /** The pager landmark's name. */
  readonly pager: string;
  readonly previous: string;
  readonly next: string;
  /** The pager's status text. */
  readonly pageOf: (page: number, pages: number) => string;
  /** With selection: the page checkbox's name. */
  readonly selectAll?: string;
  /** With selection: a row checkbox's name. */
  readonly selectRow?: (row: T) => string;
  /** With `actions`: the last column's header. */
  readonly actions?: string;
};
