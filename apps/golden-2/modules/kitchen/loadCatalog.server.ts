import { loader } from "@keel/router";
import { ok } from "@keel/schema";
import { applyQuery } from "@keel/std-tables";
import { time } from "@keel/std-timings";
import { CatalogParams } from "./CatalogParams.schema.ts";
import { CatalogResult } from "./CatalogResult.schema.ts";
import { CatalogSearch } from "./CatalogSearch.schema.ts";
import { boxStores } from "./boxStores.ts";
import { catalogColumns } from "./catalogColumns.ts";

/**
 * One page of five recipes from the box, searched, filtered and sorted by the query in the locale's collation. The
 * query is timed as `kitchen.catalog.query`.
 */
export const loadCatalog = loader(
  { output: CatalogResult, params: CatalogParams, search: CatalogSearch, stores: boxStores },
  async ({ params, search, stores }, ctx) => {
    const rows = stores.box.get("recipes").map((r) => ({ ...r, currency: r.price.currency }));
    const page = await time(ctx, "kitchen.catalog.query", () =>
      applyQuery(catalogColumns, rows, search, { pageSize: 5, locale: params.locale }),
    );
    return ok(page);
  },
);
