import { manifest } from "@keel/router";
import StartPage from "./StartPage.tsx";
import { app } from "./app.contract.ts";

export const routes = manifest(app, {
  "app.start": {
    component: StartPage,
    title: () => "Evenly",
  },
});
