import { type Computed, computed } from "@keel/reactive";
import { For } from "@keel/runtime-dom";
import { type Child, Text } from "@keel/ui";
import type { Option } from "../Option.ts";
import type { OptionState } from "./OptionState.ts";

/**
 * An option's content in a row that outlives the option object: its text as a binding, or the app's slot rendered
 * again (in a `span` with id `${id}.content`, `id` the option's part id) each time the option object changes.
 */
export function content<O extends Option>(props: {
  readonly id: string;
  readonly current: Computed<O | undefined>;
  readonly slot: ((o: O, s: OptionState) => Child) | undefined;
  readonly state: OptionState;
}): Child {
  const { current, slot, state } = props;
  if (slot === undefined) return computed(() => current.get()?.text ?? "");
  return For({
    get each() {
      const o = current.get();
      return o === undefined ? [] : [o];
    },
    key: "key",
    children: (o) => Text({ id: `${props.id}.content`, as: "span", children: () => slot(o, state) }),
  });
}
