import { type Computed, computed } from "@keel/reactive";
import { For } from "@keel/runtime-dom";
import { type Child, Text } from "@keel/ui";
import type { Option } from "../Option.ts";
import type { OptionState } from "./OptionState.ts";

/**
 * An option's content in a row that outlives the option object: its text as a binding, or the app's slot rendered
 * again (in a `span`) each time the option object changes.
 */
export function content<O extends Option>(
  current: Computed<O | undefined>,
  slot: ((o: O, s: OptionState) => Child) | undefined,
  s: OptionState,
): Child {
  if (slot === undefined) return computed(() => current.get()?.text ?? "");
  return For({
    get each() {
      const o = current.get();
      return o === undefined ? [] : [o];
    },
    key: "key",
    children: (o) => Text({ as: "span", children: () => slot(o, s) }),
  });
}
