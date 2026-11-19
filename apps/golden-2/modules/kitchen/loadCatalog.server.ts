import { loader } from "@keel/router";
import { ok } from "@keel/schema";
import { applyQuery } from "@keel/std-tables";
import { CatalogParams } from "./CatalogParams.schema.ts";
import { CatalogResult } from "./CatalogResult.schema.ts";
import { CatalogSearch } from "./CatalogSearch.schema.ts";
import { boxStores } from "./boxStores.ts";
import { catalogColumns } from "./catalogColumns.ts";

/** One page of five recipes from the box, searched, filtered and sorted by the query in the locale's collation. */
export const loadCatalog = loader(
  { output: CatalogResult, params: CatalogParams, search: CatalogSearch, stores: boxStores },
  async ({ params, search, stores }) => {
    const rows = stores.box.get("recipes").map((r) => ({ ...r, currency: r.price.currency }));
    return ok(applyQuery(catalogColumns, rows, search, { pageSize: 5, locale: params.locale }));
  },
);
