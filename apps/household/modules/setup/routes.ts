import { manifest } from "@keel/router";
import SetupPage from "./SetupPage.tsx";
import { getHousehold } from "./getHousehold.server.ts";
import { loadSetup } from "./loadSetup.server.ts";
import { saveSetup } from "./saveSetup.server.ts";
import { setup } from "./setup.contract.ts";

export const routes = manifest(setup, {
  "setup.form": { component: SetupPage, loader: loadSetup, POST: saveSetup, title: (p) => p.data.heading },
  "setup.household": { loader: getHousehold },
});
