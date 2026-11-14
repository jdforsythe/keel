import type { Ctx } from "@keel/ctx";
import { computed } from "@keel/reactive";
import { For } from "@keel/runtime-dom";
import { Box, type Child } from "@keel/ui";
import { type KeyInput, Part, type PartStyle } from "@keel/ui/aria";
import type { Option } from "./Option.ts";
import type { Named } from "./internal/Named.ts";
import type { OptionState } from "./internal/OptionState.ts";
import { listChart } from "./internal/listChart.ts";
import { nameOf } from "./internal/nameOf.ts";

/**
 * Tabs with automatic activation (std.options, APG Tabs). Parts `list`, `tab.<key>` and `panel.<key>`. Only the
 * selected tab is in the tab order; arrows move with wrap, Home and End jump, and each move selects the new tab and
 * focuses it. Only the selected tab's panel is shown.
 */
export function Tabs<K extends string>(
  props: Named & {
    readonly id: string;
    readonly tabs: () => readonly Option<K>[];
    readonly selected: () => K;
    readonly onChange: (key: K) => void;
    readonly orientation?: "vertical" | "horizontal";
    readonly tab?: (o: Option<K>, s: OptionState) => Child;
    readonly panel: (key: K) => Child;
    readonly styles?: { readonly list?: PartStyle; readonly tab?: PartStyle; readonly panel?: PartStyle };
  },
  _slots?: undefined,
  ctx?: Ctx,
): Node {
  const id = props.id;
  const l = listChart(id, "tab", props.tabs, ctx);
  const down = props.orientation === "vertical";
  const onKey = (k: KeyInput): boolean => {
    if (k.key === (down ? "ArrowDown" : "ArrowRight")) l.move("next", true);
    else if (k.key === (down ? "ArrowUp" : "ArrowLeft")) l.move("prev", true);
    else if (k.key === "Home") l.move("first", true);
    else if (k.key === "End") l.move("last", true);
    else return false;
    const o = l.activeOption();
    if (o !== undefined && o.disabled !== true) props.onChange(o.key);
    return true;
  };
  return Box({
    children: () => [
      Part({
        ...props.styles?.list,
        ...nameOf(props),
        id: `${id}.list`,
        role: "tablist",
        orientation: props.orientation ?? "horizontal",
        children: () =>
          For({
            get each() {
              return l.list.get();
            },
            key: "key",
            children: (o) => {
              const s: OptionState = {
                active: () => l.activeId.get() === l.partId(o),
                selected: () => props.selected() === o.key,
              };
              return Part({
                ...props.styles?.tab,
                id: l.partId(o),
                role: "tab",
                selected: computed(s.selected),
                controls: `${id}.panel.${o.key}`,
                tabIndex: computed(() => (s.selected() ? 0 : -1)),
                focus: computed(() => l.open.get() && s.active()),
                onFocus: () => l.opened(l.indexOf(o.key)),
                onBlur: () => l.close(false),
                onKey,
                children: () => props.tab?.(o, s) ?? o.text,
              });
            },
          }),
      }),
      For({
        get each() {
          return l.list.get();
        },
        key: "key",
        children: (o) =>
          Part({
            ...props.styles?.panel,
            id: `${id}.panel.${o.key}`,
            role: "tabpanel",
            labelledBy: l.partId(o),
            tabIndex: 0,
            hidden: computed(() => props.selected() !== o.key),
            children: () => props.panel(o.key),
          }),
      }),
    ],
  });
}
