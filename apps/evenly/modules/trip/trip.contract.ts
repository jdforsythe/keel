import { contract } from "@keel/router/contract";

export const trip = contract("trip", {
  "trip.show": {
    path: "/trip",
  },
});
