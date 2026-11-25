import { Locale } from "@keel/std-i18n";
import { tableFault } from "../unsafe/tableFault.ts";
import type { Columns } from "./Columns.type.ts";
import type { Field } from "./Field.ts";
import type { TablePage } from "./TablePage.type.ts";
import type { TableQuery } from "./TableQuery.ts";
import { checkKeys } from "./internal/checkKeys.ts";
import { compareBy } from "./internal/compareBy.ts";

const fail = (message: string): never => tableFault("E2853", message);

const byKey = (x: unknown, y: unknown): number => {
  if (typeof x === "number" && typeof y === "number") return x - y;
  const a = String(x);
  const b = String(y);
  return a < b ? -1 : a > b ? 1 : 0;
};

/**
 * One page of `rows` under `search` (std.tables Query): rows where some `search` column contains `q` and each filter
 * equals, both compared after `toLocaleLowerCase(locale)` for `q`; sorted stably by `sort` and `dir`, ties by key
 * ascending, input order without `sort`; then page `page` clamped to 1 to `pages`. Pure, deterministic and total.
 * Throws E2853 for `pageSize` outside 1 to 500, a `locale` that is not a std.i18n `Locale`, and a key repeated or
 * not id-safe.
 */
export function applyQuery<T, S extends Field<T>, F extends Field<T>>(
  cols: Columns<T, S, F>,
  rows: readonly T[],
  search: TableQuery<T, S, F>,
  opts: { readonly pageSize: number; readonly locale: Locale },
): TablePage<T> {
  const { pageSize, locale } = opts;
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 500) fail(`pageSize ${pageSize} is outside 1 to 500`);
  if (!Locale.parse(locale).ok) fail(`locale ${JSON.stringify(locale)} is not a Locale`);
  checkKeys(rows.map((row) => row[cols.key]));
  const q = search.q;
  const needle = q === undefined || cols.search.length === 0 ? undefined : q.toLocaleLowerCase(locale);
  const kept = rows.filter((row) => {
    if (needle !== undefined) {
      const hit = cols.search.some((col) => {
        const v: unknown = row[col];
        return typeof v === "string" && v.toLocaleLowerCase(locale).includes(needle);
      });
      if (!hit) return false;
    }
    return cols.filter.every((col) => {
      const want: unknown = search[col];
      return want === undefined || row[col] === want;
    });
  });
  const sort = search.sort;
  if (sort !== undefined && cols.sort.includes(sort)) {
    const cmp = compareBy(cols, sort, new Intl.Collator(locale));
    const dir = search.dir === "desc" ? -1 : 1;
    kept.sort((a, b) => dir * cmp(a, b) || byKey(a[cols.key], b[cols.key]));
  }
  const total = kept.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const asked = search.page;
  const page = Math.min(Math.max(asked !== undefined && Number.isInteger(asked) ? asked : 1, 1), pages);
  return { rows: kept.slice((page - 1) * pageSize, page * pageSize), total, page, pages };
}
