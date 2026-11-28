import { action } from "@keel/router";
import { err, ok } from "@keel/schema";
import { tx } from "@keel/store";
import { Nothing } from "./Nothing.schema.ts";
import { a } from "./a.contract.ts";
import { boards } from "./boards.ts";
export const postHome = action(a, "a.home", { input: Nothing, stores: boards }, async (_input, { stores }) => {
  const r = tx(stores.addList, { name: "one" });
  return r.ok ? ok(null) : err(r.error);
});
