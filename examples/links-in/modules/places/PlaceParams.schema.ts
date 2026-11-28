import { s } from "@keel/schema";

export const PlaceParams = s.object({ placeId: s.string({ min: 1, max: 40 }) });
