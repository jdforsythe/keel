import { manifest } from "@keel/router";
import HomePage from "./HomePage.tsx";
import PlacePage from "./PlacePage.tsx";
import { places } from "./places.contract.ts";

export const routes = manifest(places, {
  "places.home": { component: HomePage, title: () => "Places" },
  "places.place": { component: PlacePage, title: (p) => `Place ${p.params.placeId}` },
});
