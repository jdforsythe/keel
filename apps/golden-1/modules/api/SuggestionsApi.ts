import { Box } from "@keel/ui";
import type { Suggestion } from "../todos/Suggestion.schema.ts";

/**
 * Document view of `api.suggestions`; runtime requests (`accept: application/json`) get the loader `Result`.
 * Plain `.ts` (no JSX).
 */
export default function SuggestionsApi(props: { readonly data: readonly Suggestion[] }): Node {
  return Box({
    as: "ul",
    id: "api.suggestions",
    children: props.data.map((x) => Box({ as: "li", children: x.title })),
  });
}
