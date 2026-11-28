import { columns } from "@keel/std-tables";
import { CatalogRow } from "./CatalogRow.schema.ts";

/**
 * The catalog table: title, price, minutes, date and favorite shown; sorted by title, price, minutes or date;
 * searched by title; filtered by currency and favorite. Prices order by amount, then by currency.
 */
export const catalogColumns = columns(CatalogRow, {
  key: "id",
  rowHeader: "title",
  show: ["title", "price", "minutes", "addedOn", "favorite"],
  sort: ["title", "price", "minutes", "addedOn"],
  search: ["title"],
  filter: ["currency", "favorite"],
  compare: {
    price: (a, b) => a.amount - b.amount || (a.currency < b.currency ? -1 : a.currency > b.currency ? 1 : 0),
  },
});
