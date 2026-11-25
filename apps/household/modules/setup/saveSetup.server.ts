import { action } from "@keel/router";
import { pageHref } from "@keel/router/match";
import { err, ok } from "@keel/schema";
import { tx } from "@keel/store";
import { SetupForm } from "./SetupForm.schema.ts";
import { householdStores } from "./householdStores.server.ts";
import { setup } from "./setup.contract.ts";

export const saveSetup = action(
  setup,
  "setup.form",
  { input: SetupForm, stores: householdStores },
  async (input, { url, caller, stores, routes }) => {
    const r = tx(stores.name, input, { meta: { caller } });
    if (!r.ok) return err(r.error);
    // The page the guard sent the member from, when `next` names one of this app's pages; else the page stays.
    const back = pageHref(routes, new URL(url).searchParams.get("next") ?? "");
    return ok(back.ok ? back.value : null);
  },
);
