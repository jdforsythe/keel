import { loader } from "@keel/router";
import { ok } from "@keel/schema";
import { Tally } from "@keel/std-report";
import { boxStores } from "./boxStores.ts";
import { currencyTally } from "./currencyTally.server.ts";

/** The box's recipes counted by the currency of their price (`currencyTally`), as `keel report` reads it from a build. */
export const loadCurrencyTally = loader({ output: Tally, stores: boxStores }, async ({ stores }, ctx) =>
  ok(currencyTally(ctx, stores.box.get("recipes"))),
);
