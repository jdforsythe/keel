import { type Infer, s } from "@keel/schema";
import { Box } from "@keel/ui";

export const Props = s.object({});

/** Document view of `digest.refresh`, which only takes POST (`accept: application/json` gets the action `Result`). */
export default function RefreshApi(_props: Infer<typeof Props>): Node {
  return Box({ id: "digest.action", children: "POST only" });
}
