import type { Ctx } from "@keel/ctx";
import { computed } from "@keel/reactive";
import { instance } from "@keel/std-statecharts";
import { tx } from "@keel/store";
import { Box, type Child, type Children } from "@keel/ui";
import { Part, type PartStyle } from "@keel/ui/aria";
import { openChart } from "./openChart.ts";

/**
 * A button that shows and hides a panel (std.headless, APG Disclosure). Parts `button` and `panel`; a click, Enter or
 * Space toggles it.
 */
export function Disclosure(
  props: {
    readonly id: string;
    readonly summary: () => Child;
    readonly children: Children;
    readonly styles?: { readonly button?: PartStyle; readonly panel?: PartStyle };
  },
  _slots?: undefined,
  _ctx?: Ctx,
): Node {
  const id = props.id;
  const c = instance(openChart, id);
  const open = computed(() => c.store.get("state") === "open");
  return Box({
    children: () => [
      Part({
        ...props.styles?.button,
        id: `${id}.button`,
        role: "button",
        expanded: open,
        controls: `${id}.panel`,
        onClick: () => tx(c.events.toggle, {}),
        children: props.summary,
      }),
      Part({
        ...props.styles?.panel,
        id: `${id}.panel`,
        role: "generic",
        hidden: computed(() => !open.get()),
        children: props.children,
      }),
    ],
  });
}
