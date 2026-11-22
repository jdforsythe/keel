import { contract } from "@keel/router/contract";
import { PlaceParams } from "./PlaceParams.schema.ts";

/** A home page and one page per place; a link from outside the shell can open either. */
export const places = contract("places", {
  "places.home": { path: "/" },
  "places.place": { path: "/places/:placeId", params: PlaceParams },
});
