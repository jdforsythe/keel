import { type ObjectSchema, type Schema, s } from "@keel/schema";
import type { TablePage } from "./TablePage.type.ts";

/** The schema of one page of rows `row`: `{ rows, total, page, pages }`, what a server source's loader returns. */
export function tablePage<T>(row: Schema<T>): ObjectSchema<TablePage<T>> {
  return s.object({
    rows: s.array(row),
    total: s.int({ min: 0 }),
    page: s.int({ min: 1 }),
    pages: s.int({ min: 1 }),
  });
}
