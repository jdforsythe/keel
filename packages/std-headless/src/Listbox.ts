import type { Ctx } from "@keel/ctx";
import { computed } from "@keel/reactive";
import { For } from "@keel/runtime-dom";
import type { Child } from "@keel/ui";
import { type KeyInput, Part, type PartStyle } from "@keel/ui/aria";
import type { Option } from "./Option.ts";
import type { Named } from "./internal/Named.ts";
import type { OptionState } from "./internal/OptionState.ts";
import { content } from "./internal/content.ts";
import { nameOf } from "./internal/nameOf.ts";
import { listChart } from "./listChart.ts";

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
  ctx: Ctx,
): Node {
  const l = listChart(props.id, "option", props.options, ctx);
  const pick = (o: Option<K> | undefined) => {
    if (o === undefined || o.disabled === true) return;
    const now = props.selected();
    if (props.mode === "single") props.onChange([o.key]);
    else props.onChange(now.includes(o.key) ? now.filter((k) => k !== o.key) : [...now, o.key]);
  };
  const onKey = (k: KeyInput): boolean => {
    const across = props.orientation === "horizontal";
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
    multiselectable: computed(() => props.mode === "multiple"),
    orientation: computed(() => props.orientation ?? "vertical"),
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
          return l.rows.get();
        },
        key: "key",
        children: ({ key }) => {
          const o = computed(() => l.current(key));
          const s: OptionState = {
            active: () => l.activeId.get() === l.partId(key),
            selected: () => props.selected().includes(key),
          };
          return Part({
            ...props.styles?.option,
            id: l.partId(key),
            role: "option",
            selected: computed(s.selected),
            disabled: computed(() => o.get()?.disabled === true),
            onClick: () => {
              l.jump(l.indexOf(key));
              pick(o.get());
            },
            children: () => content(o, props.option, s),
          });
        },
      }),
  });
}
