import { ok, s } from "@keel/schema";
import { action } from "../../src/action.ts";
import { routes } from "./routes.ts";

export const save = action({ input: s.object({}) }, async () => ok(routes.href("cyc.page")));
