import { manifest } from "@keel/router";
import AppFrame from "./AppFrame.tsx";
import StartPage from "./StartPage.tsx";
import { app } from "./app.contract.ts";
import { loadFrame } from "./loadFrame.server.ts";
import { loadStart } from "./loadStart.server.ts";

export const routes = manifest(app, {
  "app.frame": { component: AppFrame, loader: loadFrame },
  "app.start": { component: StartPage, layout: "app.frame", loader: loadStart, title: (p) => p.data.heading },
});
