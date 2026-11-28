import { contract } from "@keel/router/contract";
import { Me } from "./Me.schema.ts";

export const api = contract("api", {
  "api.me": { method: "GET", path: "/api/me", output: Me },
});
