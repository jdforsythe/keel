import { loader } from "@keel/router";
import { ok } from "@keel/schema";
import { a } from "./a.contract.ts";
import { boards } from "./boards.ts";
import { Count } from "./Count.schema.ts";
export const loadHome = loader(a, "a.home", { output: Count, stores: boards }, async ({ stores }) =>
  ok({ count: stores.board.get("lists").length }),
);
