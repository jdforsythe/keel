import { loader } from "@keel/router";
import { ok } from "@keel/schema";
import { Home } from "./Home.schema.ts";
import { shop } from "./shop.contract.ts";
import { stockApi } from "./stockApi.ts";

/** Asks the `stock` module for the count of lamps: in process, or at its peer once it has a deployable of its own. */
export const loadHome = loader(shop, "shop.home", { output: Home }, async (_args, ctx) => {
  const r = await stockApi.count({ params: { item: "lamp" } }, ctx);
  return ok({ shelf: r.ok ? `${r.value.count} ${r.value.item}s on the shelf` : r.error.code });
});
