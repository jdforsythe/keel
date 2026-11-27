import { contract } from "@keel/router/contract";
import { InspectSearch } from "./InspectSearch.schema.ts";

export const inspector = contract("inspector", {
  "inspector.index": { path: "/", search: InspectSearch, local: true },
});
