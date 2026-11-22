import { manifest } from "@keel/router";
import { member } from "../members/member.guard.ts";
import { signedIn } from "../members/signedIn.guard.ts";
import SetupPage from "./SetupPage.tsx";
import SetupShell from "./SetupShell.tsx";
import { getHousehold } from "./getHousehold.server.ts";
import { loadSetup } from "./loadSetup.server.ts";
import { loadShell } from "./loadShell.server.ts";
import { saveSetup } from "./saveSetup.server.ts";
import { setup } from "./setup.contract.ts";

export const routes = manifest(setup, {
  "setup.shell": { component: SetupShell, loader: loadShell },
  "setup.form": {
    component: SetupPage,
    layout: "setup.shell",
    loader: loadSetup,
    guard: signedIn,
    POST: saveSetup,
    title: (p) => p.data.heading,
  },
  "setup.household": { loader: getHousehold, guard: member },
});
