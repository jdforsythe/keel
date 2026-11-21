import { loader } from "@keel/router";
import { ok } from "@keel/schema";
import { Home } from "./Home.schema.ts";
import { app } from "./app.contract.ts";

export const loadHome = loader(app, "app.home", { output: Home }, async () =>
  ok({
    heading: "Rainfall",
    chart: "Rainfall by month, in millimeters",
    rain: {
      bars: [
        { name: "April", value: 40 },
        { name: "May", value: 65 },
        { name: "June", value: 25 },
      ],
    },
  }),
);
