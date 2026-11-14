import type { Ctx } from "@keel/ctx";
import { effect, owner, signal } from "@keel/reactive";
import type { Href } from "@keel/router";
import { findRouter } from "@keel/router/internal";
import { Input } from "@keel/ui";
import type { Field } from "./Field.ts";
import type { TableQuery } from "./TableQuery.ts";
import { Q_MAX } from "./internal/Q_MAX.ts";
import { debounced } from "./internal/debounced.ts";
import { withQuery } from "./internal/withQuery.ts";

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
  // The input keeps its text while `search.q` is the value it last sent (typing goes on during the load, and text past
  // `Q_MAX` stays); any other `q` (back, forward, a link) replaces it and becomes the new baseline.
  let q = props.search.q ?? "";
  let sent = q;
  const shown = signal(q);
  effect(
    () => {
      const at = props.search.q ?? "";
      if (at !== sent) {
        sent = at;
        q = at;
      }
      shown.set(q);
    },
    { writes: [shown] },
  );
  const timer =
    router === null || clock === undefined
      ? undefined
      : debounced(
          clock,
          () => props.delay ?? 300,
          () => {
            sent = q.slice(0, Q_MAX);
            void router.navigate(props.href(withQuery(props.search, sent)), { replace: true });
          },
        );
  owner()?.onDispose(() => timer?.cancel());
  return Input({
    id,
    // Read once: k.ui `Input` takes `label` as a string.
    label: props.label,
    type: "search",
    value: shown,
    onInput: (value) => {
      q = value;
      shown.set(value);
      timer?.push();
    },
  });
}
