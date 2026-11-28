import { ok, s } from "@keel/schema";
import { action } from "../../src/action.ts";
import { cyc } from "./contract.ts";

// A page action in its own file imports the contract, not the route table: routes.ts binds it, with no annotation.
export const save = action(cyc, "cyc.page", { input: s.object({}) }, async () => ok(cyc.href("cyc.page")));
