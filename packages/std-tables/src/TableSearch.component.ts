import type { Ctx } from "@keel/ctx";
import { owner } from "@keel/reactive";
import type { Href } from "@keel/router";
import { findRouter } from "@keel/router/internal";
import { Input } from "@keel/ui";
import type { Field } from "./Field.ts";
import type { TableQuery } from "./TableQuery.ts";
import { debounced } from "./internal/debounced.ts";
import { withQuery } from "./internal/withQuery.ts";

/**
 * A search input for a table's `q` (std.tables TableSearch): `delay` ms (default 300, on `ctx.clock`) after the last
 * input it replaces the history entry with `href(search)`, `q` set (absent when empty) and `page` dropped.
 */
export function TableSearch<T, S extends Field<T>, F extends Field<T>>(
  props: {
    readonly id: string;
    readonly label: string;
    readonly search: TableQuery<T, S, F>;
    readonly href: (search: TableQuery<T, S, F>) => Href;
    readonly delay?: number;
  },
  _slots?: undefined,
  ctx?: Ctx,
): Node {
  const router = findRouter();
  const clock = (ctx ?? router?.ctx)?.clock;
  let q = props.search.q ?? "";
  const timer =
    router === null || clock === undefined
      ? undefined
      : debounced(clock, props.delay ?? 300, () => {
          void router.navigate(props.href(withQuery(props.search, q)), { replace: true });
        });
  owner()?.onDispose(() => timer?.cancel());
  return Input({
    id: `${props.id}.input`,
    label: props.label,
    type: "search",
    value: props.search.q ?? "",
    onInput: (value) => {
      q = value;
      timer?.push();
    },
  });
}
