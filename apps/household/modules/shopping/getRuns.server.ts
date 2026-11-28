import { loader } from "@keel/router";
import { ok } from "@keel/schema";
import { restockStores } from "./restockStores.server.ts";
import { runsOf } from "./runsOf.ts";
import { shopping } from "./shopping.contract.ts";

export const getRuns = loader(shopping, "shopping.runs", { stores: restockStores }, async ({ stores }) =>
  ok(runsOf(stores.restock.store.get("instances"))),
);
