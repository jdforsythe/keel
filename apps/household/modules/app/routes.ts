import { manifest } from "@keel/router";
import AppShell from "./AppShell.tsx";
import StartPage from "./StartPage.tsx";
import { app } from "./app.contract.ts";
import { loadShell } from "./loadShell.server.ts";
import { loadStart } from "./loadStart.server.ts";

export const routes = manifest(app, {
  "app.shell": { component: AppShell, loader: loadShell },
  "app.start": { component: StartPage, layout: "app.shell", loader: loadStart, title: (p) => p.data.heading },
});
