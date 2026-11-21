import { loader } from "@keel/router";
import { ok } from "@keel/schema";
import { Home } from "./Home.schema.ts";
import { app } from "./app.contract.ts";

export const loadHome = loader(app, "app.home", { output: Home }, async () =>
  ok({ heading: "Static files only", note: "This page runs in the browser. No Keel server sent it." }),
);
