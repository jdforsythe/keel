import { endpoints } from "@keel/services";
import { InspectDoc } from "./InspectDoc.schema.ts";

/**
 * The dev inspect endpoint of a running Keel app (k.cli Inspect). The client is built per load with
 * `service({ base: url, schema: inspectApi })`, `url` being the route's search param.
 */
export const inspectApi = endpoints({
  get: { method: "GET", path: "/__keel/inspect", output: InspectDoc },
});
