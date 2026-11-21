import type { Infer } from "@keel/schema";
import { tableSearch } from "@keel/std-tables";
import { catalogColumns } from "./catalogColumns.ts";

/** The catalog's query in the URL: `sort`, `dir`, `page`, `q`, `currency` and `favorite`, each optional. */
export const CatalogSearch = tableSearch(catalogColumns);

export type CatalogSearch = Infer<typeof CatalogSearch>;
