import { contract } from "@keel/router/contract";
import { Nothing } from "../api/Nothing.schema.ts";
import { Digest } from "./Digest.schema.ts";
import { RecountInput } from "./RecountInput.schema.ts";

/** The `digest` module's routes: the newest digest, a request to recount, and a live feed of each new digest. */
export const digest = contract("digest", {
  "digest.show": { method: "GET", path: "/digest", output: Digest },
  "digest.refresh": { method: "POST", path: "/digest/refresh", body: RecountInput, output: Nothing },
  "digest.feed": { method: "GET", path: "/digest/feed", output: Digest, events: true },
});
