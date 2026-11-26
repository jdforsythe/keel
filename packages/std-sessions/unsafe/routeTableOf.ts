import type { RouteTable } from "@keel/router";
import { field } from "../src/group/internal/field.ts";
import { unsafe } from "./unsafe.ts";

/** A user module's `routes` export as a route table when its own `kind` is `keel.routeTable` with a `contracts` array. */
export function routeTableOf(x: unknown): RouteTable | undefined {
  if (field(x, "kind") !== "keel.routeTable" || !Array.isArray(field(x, "contracts"))) return undefined;
  return unsafe(
    "only router routeTable makes a value of kind keel.routeTable, and a group user module exports the table it built as routes, so the value is a RouteTable",
    () => x as RouteTable,
  );
}
