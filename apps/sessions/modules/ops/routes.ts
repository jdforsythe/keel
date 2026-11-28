import { manifest } from "@keel/router";
import Home from "./Home.ts";
import { ops } from "./ops.contract.ts";

/** The `ops` module's route table: the home page. `topology.ts` places `sessions`, whose package serves its routes. */
export const routes = manifest(ops, {
  "ops.home": { component: Home },
});
