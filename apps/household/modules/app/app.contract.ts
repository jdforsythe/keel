import { contract } from "@keel/router/contract";

export const app = contract("app", {
  "app.shell": { layout: true },
  "app.start": { path: "/" },
});
