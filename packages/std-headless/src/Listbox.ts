import type { Ctx } from "@keel/ctx";
import { computed } from "@keel/reactive";
import { For } from "@keel/runtime-dom";
import type { Child } from "@keel/ui";
import { type KeyInput, Part, type PartStyle } from "@keel/ui/aria";
import type { Option } from "./Option.ts";
import type { Named } from "./internal/Named.ts";
import type { OptionState } from "./internal/OptionState.ts";
import { listChart } from "./internal/listChart.ts";
import { nameOf } from "./internal/nameOf.ts";

/**
 * A list a person picks one or several options from (std.options, APG Listbox). Parts `list` and `option.<key>`.
 * Focus on the list opens it at the first selected option; arrows move without wrap, Home and End jump, a printable
 * key searches; Space (and Enter in `single`) or a click picks the active option. Focus stays on the list.
 */
export function Listbox<K extends string>(
  props: Named & {
    readonly id: string;
    readonly options: () => readonly Option<K>[];
    readonly mode: "single" | "multiple";
    readonly selected: () => readonly K[];
    readonly onChange: (keys: K[]) => void;
    readonly orientation?: "vertical" | "horizontal";
    readonly option?: (o: Option<K>, s: OptionState) => Child;
    readonly styles?: { readonly list?: PartStyle; readonly option?: PartStyle };
  },
  _slots?: undefined,
  ctx?: Ctx,
): Node {
  const l = listChart(props.id, "option", props.options, ctx);
  const pick = (o: Option<K> | undefined) => {
    if (o === undefined || o.disabled === true) return;
    const now = props.selected();
    if (props.mode === "single") props.onChange([o.key]);
    else props.onChange(now.includes(o.key) ? now.filter((k) => k !== o.key) : [...now, o.key]);
  };
  const across = props.orientation === "horizontal";
  const onKey = (k: KeyInput): boolean => {
    if (k.key === (across ? "ArrowRight" : "ArrowDown")) l.move("next", false);
    else if (k.key === (across ? "ArrowLeft" : "ArrowUp")) l.move("prev", false);
    else if (k.key === "Home") l.move("first", false);
    else if (k.key === "End") l.move("last", false);
    else if (k.key === " " || (k.key === "Enter" && props.mode === "single")) pick(l.activeOption());
    else return l.typeahead(k);
    return true;
  };
  return Part({
    ...props.styles?.list,
    ...nameOf(props),
    id: `${props.id}.list`,
    role: "listbox",
    tabIndex: 0,
    multiselectable: props.mode === "multiple",
    orientation: props.orientation ?? "vertical",
    activeDescendant: l.activeId,
    onFocus: () => {
      const now = props.selected();
      l.opened(
        Math.max(
          0,
          l.list.get().findIndex((o) => now.includes(o.key)),
        ),
      );
    },
    onBlur: () => l.close(false),
    onKey,
    children: () =>
      For({
        get each() {
          return l.list.get();
        },
        key: "key",
        children: (o) => {
          const s: OptionState = {
            active: () => l.activeId.get() === l.partId(o),
            selected: () => props.selected().includes(o.key),
          };
          return Part({
            ...props.styles?.option,
            id: l.partId(o),
            role: "option",
            selected: computed(s.selected),
            disabled: o.disabled === true,
            onClick: () => {
              l.jump(l.indexOf(o.key));
              pick(o);
            },
            children: () => props.option?.(o, s) ?? o.text,
          });
        },
      }),
  });
}
