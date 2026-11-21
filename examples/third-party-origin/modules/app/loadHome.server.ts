import { loader } from "@keel/router";
import { ok } from "@keel/schema";
import { Home } from "./Home.schema.ts";
import { app } from "./app.contract.ts";

export const loadHome = loader(app, "app.home", { output: Home }, async () =>
  ok({ heading: "One map tile", alt: "The whole world on one map tile" }),
);
