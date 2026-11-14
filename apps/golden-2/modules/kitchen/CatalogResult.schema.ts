import { tablePage } from "@keel/std-tables";
import { CatalogRow } from "./CatalogRow.schema.ts";

/** One page of the catalog: its rows, the matching total, the page number and the page count. */
export const CatalogResult = tablePage(CatalogRow);
