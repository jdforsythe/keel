import { Box } from "@keel/ui";
import type { BoardView } from "../todos/BoardView.schema.ts";

/**
 * Document view of `api.lists` (list names); runtime requests (`accept: application/json`) get the loader `Result`.
 * Plain `.ts` (no JSX) so `node server.ts` can load the api deployable with type stripping alone.
 */
export default function BoardApi(props: { readonly data: BoardView }): Node {
  return Box({ as: "ul", id: "api.lists", children: props.data.lists.map((l) => Box({ as: "li", children: l.name })) });
}
