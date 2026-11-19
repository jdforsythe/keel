/** One page of a table's result: what `applyQuery` returns and `tablePage(row)` parses. */
export type TablePage<T> = {
  rows: T[];
  /** Rows after search and filters, over all pages. */
  total: number;
  /** 1 to `pages`. */
  page: number;
  /** max(1, ceil(total / pageSize)). */
  pages: number;
};
