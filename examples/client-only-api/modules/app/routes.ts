import { manifest } from "@keel/router";
import HomePage from "./HomePage.tsx";
import ReleasesPage from "./ReleasesPage.tsx";
import { app } from "./app.contract.ts";

export const routes = manifest(app, {
  "app.home": {
    component: HomePage,
    title: () => "client-only-api",
  },
  "app.releases": {
    component: ReleasesPage,
    title: () => "Releases",
  },
});
