import type { Ctx } from "@keel/ctx";
import { owner } from "@keel/reactive";
import type { Href } from "@keel/router";
import { findRouter } from "@keel/router/internal";
import { Input } from "@keel/ui";
import type { Field } from "./Field.ts";
import type { TableQuery } from "./TableQuery.ts";
import { Q_MAX } from "./internal/Q_MAX.ts";
import { debounced } from "./internal/debounced.ts";
import { withQuery } from "./internal/withQuery.ts";

/** By input id: text typed past `Q_MAX`, kept for the input the navigation rebuilds. */
const typed = new Map<string, string>();

/**
 * A search input for a table's `q` (std.tables TableSearch): `delay` ms (default 300, on `ctx.clock`) after the last
 * input it replaces the history entry with `href(search)`, `q` set to the first `Q_MAX` characters (absent when
 * empty) and `page` dropped. Text past the limit stays in the input and does not filter.
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
  const id = `${props.id}.input`;
  const sent = props.search.q ?? "";
  const kept = typed.get(id);
  typed.delete(id);
  let q = kept !== undefined && kept.slice(0, Q_MAX) === sent ? kept : sent;
  const timer =
    router === null || clock === undefined
      ? undefined
      : debounced(clock, props.delay ?? 300, () => {
          if (q.length > Q_MAX) typed.set(id, q);
          void router.navigate(props.href(withQuery(props.search, q.slice(0, Q_MAX))), { replace: true });
        });
  owner()?.onDispose(() => timer?.cancel());
  return Input({
    id,
    label: props.label,
    type: "search",
    value: q,
    onInput: (value) => {
      q = value;
      timer?.push();
    },
  });
}
