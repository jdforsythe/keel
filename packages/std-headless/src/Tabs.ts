import type { Ctx } from "@keel/ctx";
import { computed } from "@keel/reactive";
import { For } from "@keel/runtime-dom";
import { Box, type Child } from "@keel/ui";
import { type KeyInput, Part, type PartStyle } from "@keel/ui/aria";
import type { Option } from "./Option.ts";
import type { Named } from "./internal/Named.ts";
import type { OptionState } from "./internal/OptionState.ts";
import { content } from "./internal/content.ts";
import { nameOf } from "./internal/nameOf.ts";
import { listChart } from "./listChart.ts";

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
  ctx: Ctx,
): Node {
  const id = props.id;
  const l = listChart(id, "tab", props.tabs, ctx);
  const onKey = (k: KeyInput): boolean => {
    const down = props.orientation === "vertical";
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
        orientation: computed(() => props.orientation ?? "horizontal"),
        children: () =>
          For({
            get each() {
              return l.rows.get();
            },
            key: "key",
            children: ({ key }) => {
              const o = computed(() => l.current(key));
              const s: OptionState = {
                active: () => l.activeId.get() === l.partId(key),
                selected: () => props.selected() === key,
              };
              return Part({
                ...props.styles?.tab,
                id: l.partId(key),
                role: "tab",
                selected: computed(s.selected),
                controls: `${id}.panel.${key}`,
                tabIndex: computed(() => (s.selected() ? 0 : -1)),
                focus: computed(() => l.open.get() && s.active()),
                onFocus: () => l.opened(l.indexOf(key)),
                onBlur: () => l.close(false),
                onKey,
                onClick: () => {
                  const option = o.get();
                  if (option === undefined || option.disabled === true) return;
                  l.opened(l.indexOf(key));
                  l.jump(l.indexOf(key));
                  props.onChange(key);
                },
                children: () => content(o, props.tab, s),
              });
            },
          }),
      }),
      For({
        get each() {
          return l.rows.get();
        },
        key: "key",
        children: ({ key }) =>
          Part({
            ...props.styles?.panel,
            id: `${id}.panel.${key}`,
            role: "tabpanel",
            labelledBy: l.partId(key),
            tabIndex: 0,
            hidden: computed(() => props.selected() !== key),
            children: () => props.panel(key),
          }),
      }),
    ],
  });
}
