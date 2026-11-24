import { manifest } from "@keel/router";
import { a } from "./a.contract.ts";
import { admit } from "./admit.ts";
import { page } from "./page.ts";

/** The module's routes; `a.board` is guarded by `admit`. */
export const routes = manifest(a, {
  "a.board": { component: page("a.board"), guard: admit },
  "a.signin": { component: page("a.signin") },
  "a.about": { component: page("a.about") },
  "a.help": { component: page("a.help") },
});
