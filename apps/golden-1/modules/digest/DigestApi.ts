import { type Infer, s } from "@keel/schema";
import { Box } from "@keel/ui";
import { Digest } from "./Digest.schema.ts";

export const Props = s.object({ data: Digest });

/**
 * Document view of `digest.show` and `digest.feed`: the open and done counts. Runtime requests
 * (`accept: application/json`) get the loader `Result`, event-stream requests every yield.
 */
export default function DigestApi(props: Infer<typeof Props>): Node {
  return Box({
    as: "ul",
    id: "digest.counts",
    children: () => [
      Box({ as: "li", id: "digest.open", children: String(props.data.open) }),
      Box({ as: "li", id: "digest.done", children: String(props.data.done) }),
    ],
  });
}
