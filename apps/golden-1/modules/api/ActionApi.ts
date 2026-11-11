import { Box } from "@keel/ui";

/**
 * Document view of the `api` routes that only take actions (POST with `accept: application/json` gets the action
 * `Result`). Plain `.ts` (no JSX).
 */
export default function ActionApi(): Node {
  return Box({ id: "api.action", children: "POST only" });
}
