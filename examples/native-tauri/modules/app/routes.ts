import { manifest } from "@keel/router";
import HomePage from "./HomePage.tsx";
import { app } from "./app.contract.ts";

export const routes = manifest(app, {
  "app.home": {
    component: HomePage,
  },
});
