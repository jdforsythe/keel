import type { Ctx } from "@keel/ctx";
import { computed } from "@keel/reactive";
import { For } from "@keel/runtime-dom";
import { Box, type Child } from "@keel/ui";
import { type KeyInput, Part, type PartStyle } from "@keel/ui/aria";
import type { Option } from "./Option.ts";
import type { OptionState } from "./internal/OptionState.ts";
import { content } from "./internal/content.ts";
import { listChart } from "./internal/listChart.ts";

/**
 * A button that opens a list of actions (std.options, APG Menu Button). Parts `trigger`, `menu` and `item.<key>`; an
 * item with `checked` is a `menuitemcheckbox`. Enter, Space or ArrowDown on the trigger open the menu at the first
 * item, ArrowUp at the last; in the menu arrows move with wrap, Enter, Space or a click choose, Escape closes and
 * returns focus to the trigger, Tab closes and moves on.
 */
export function Menu<K extends string>(
  props: {
    readonly id: string;
    readonly trigger: () => Child;
    readonly items: () => readonly (Option<K> & { readonly checked?: boolean })[];
    readonly onSelect: (key: K) => void;
    readonly item?: (o: Option<K>, s: OptionState) => Child;
    readonly styles?: { readonly trigger?: PartStyle; readonly menu?: PartStyle; readonly item?: PartStyle };
  },
  _slots?: undefined,
  ctx?: Ctx,
): Node {
  const id = props.id;
  const l = listChart(id, "item", props.items, ctx);
  const select = (o: Option<K> | undefined) => {
    if (o === undefined || o.disabled === true) return;
    l.choose();
    props.onSelect(o.key);
  };
  const onTrigger = (k: KeyInput): boolean => {
    if (k.key === "Enter" || k.key === " " || k.key === "ArrowDown") l.opened(0);
    else if (k.key === "ArrowUp") l.opened(l.list.get().length - 1);
    else return false;
    return true;
  };
  const onMenu = (k: KeyInput): boolean => {
    if (k.key === "ArrowDown") l.move("next", true);
    else if (k.key === "ArrowUp") l.move("prev", true);
    else if (k.key === "Home") l.move("first", true);
    else if (k.key === "End") l.move("last", true);
    else if (k.key === "Enter" || k.key === " ") select(l.activeOption());
    else if (k.key === "Escape") l.close(true);
    else if (k.key === "Tab") {
      l.close(false);
      return false;
    } else return l.typeahead(k);
    return true;
  };
  return Box({
    children: () => [
      Part({
        ...props.styles?.trigger,
        id: `${id}.trigger`,
        role: "button",
        hasPopup: "menu",
        expanded: l.open,
        focus: computed(() => !l.open.get() && l.back()),
        onClick: () => l.opened(0),
        onKey: onTrigger,
        children: props.trigger,
      }),
      Part({
        ...props.styles?.menu,
        id: `${id}.menu`,
        role: "menu",
        labelledBy: `${id}.trigger`,
        tabIndex: -1,
        activeDescendant: l.activeId,
        hidden: computed(() => !l.open.get()),
        focus: l.open,
        onBlur: () => l.close(false),
        onKey: onMenu,
        children: () =>
          For({
            get each() {
              return l.rows.get();
            },
            key: "key",
            children: ({ key }) => {
              const o = computed(() => l.current(key));
              const s: OptionState = { active: () => l.activeId.get() === l.partId(key), selected: () => false };
              const common = {
                ...props.styles?.item,
                id: l.partId(key),
                disabled: computed(() => o.get()?.disabled === true),
                onClick: () => {
                  l.jump(l.indexOf(key));
                  select(o.get());
                },
                children: () => content(o, props.item, s),
              };
              // The role is chosen when the row is made: an item is a checkbox item while it has `checked`.
              return o.get()?.checked === undefined
                ? Part({ ...common, role: "menuitem" })
                : Part({ ...common, role: "menuitemcheckbox", checked: computed(() => o.get()?.checked === true) });
            },
          }),
      }),
    ],
  });
}
