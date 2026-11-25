import { manifest } from "@keel/router";
import ShowPage from "./ShowPage.tsx";
import { trip } from "./trip.contract.ts";

export const routes = manifest(trip, {
  "trip.show": {
    component: ShowPage,
  },
});
