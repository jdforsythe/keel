import { contract } from "@keel/router/contract";

export const app = contract("app", {
  "app.home": {
    path: "/",
  },
});
