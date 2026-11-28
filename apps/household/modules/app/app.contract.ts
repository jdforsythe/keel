import { contract } from "@keel/router/contract";

export const app = contract("app", {
  "app.frame": { layout: true },
  "app.start": { path: "/" },
});
