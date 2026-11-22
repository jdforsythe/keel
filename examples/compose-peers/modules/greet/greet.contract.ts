import { contract } from "@keel/router/contract";
import { Greeting } from "./Greeting.schema.ts";

export const greet = contract("greet", {
  "greet.hello": { method: "GET", path: "/api/hello", output: Greeting },
});
