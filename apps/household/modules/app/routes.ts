import { manifest } from "@keel/router";
import StartPage from "./StartPage.tsx";
import { app } from "./app.contract.ts";
import { loadStart } from "./loadStart.server.ts";

export const routes = manifest(app, {
  "app.start": { component: StartPage, loader: loadStart, title: (p) => p.data.heading },
});
