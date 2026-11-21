import type { Ctx } from "@keel/ctx";
import { computed } from "@keel/reactive";
import { For, If } from "@keel/runtime-dom";
import { Box, type Child, Text } from "@keel/ui";
import { type KeyInput, Part, type PartStyle } from "@keel/ui/aria";
import type { Option } from "./Option.ts";
import type { Named } from "./internal/Named.ts";
import type { OptionState } from "./internal/OptionState.ts";
import { content } from "./internal/content.ts";
import { nameOf } from "./internal/nameOf.ts";
import { listChart } from "./listChart.ts";

/**
 * A text input with a list of suggestions the app filters from `text` (std.options, APG Combobox, list autocomplete,
 * manual selection). Parts `input`, `list`, `option.<key>` and `empty`. Arrows open the list and move with wrap,
 * Alt+ArrowDown opens it with nothing active, Enter chooses the active option, Escape closes the list or, closed,
 * clears the text. Focus stays on the input.
 */
export function Combobox<K extends string>(
  props: Named & {
    readonly id: string;
    readonly text: () => string;
    readonly onInput: (text: string) => void;
    readonly options: () => readonly Option<K>[];
    readonly onChange: (key: K) => void;
    readonly option?: (o: Option<K>, s: OptionState) => Child;
    readonly empty?: () => Child;
    readonly styles?: {
      readonly input?: PartStyle;
      readonly list?: PartStyle;
      readonly option?: PartStyle;
      readonly empty?: PartStyle;
    };
  },
  _slots?: undefined,
  ctx?: Ctx,
): Node {
  const id = props.id;
  const l = listChart(id, "option", props.options, ctx);
  const none = computed(() => l.list.get().length === 0);
  const onKey = (k: KeyInput): boolean => {
    const open = l.open.get();
    if (k.key === "ArrowDown") {
      if (k.alt) l.opened(-1);
      else if (open) l.move("next", true);
      else l.opened(0);
    } else if (k.key === "ArrowUp") {
      if (open) l.move("prev", true);
      else l.opened(l.list.get().length - 1);
    } else if (k.key === "Enter") {
      const o = l.activeOption();
      if (!open || o === undefined || o.disabled === true) return false;
      l.choose();
      props.onChange(o.key);
    } else if (k.key === "Escape") {
      if (open) l.close(false);
      else props.onInput("");
    } else return false;
    return true;
  };
  return Box({
    children: () => [
      Part({
        ...props.styles?.input,
        ...nameOf(props),
        id: `${id}.input`,
        role: "combobox",
        expanded: l.open,
        controls: `${id}.list`,
        activeDescendant: l.activeId,
        value: computed(props.text),
        onInput: (text) => {
          props.onInput(text);
          if (l.open.get()) l.jump(-1);
          else l.opened(-1);
        },
        onBlur: () => l.close(false),
        onKey,
      }),
      Part({
        ...props.styles?.list,
        ...nameOf(props),
        id: `${id}.list`,
        role: "listbox",
        hidden: computed(() => !l.open.get() || none.get()),
        children: () =>
          For({
            get each() {
              return l.rows.get();
            },
            key: "key",
            children: ({ key }) => {
              const o = computed(() => l.current(key));
              const s: OptionState = { active: () => l.activeId.get() === l.partId(key), selected: () => false };
              return Part({
                ...props.styles?.option,
                id: l.partId(key),
                role: "option",
                selected: computed(s.active),
                disabled: computed(() => o.get()?.disabled === true),
                onClick: () => {
                  if (o.get()?.disabled === true) return;
                  l.jump(l.indexOf(key));
                  l.choose();
                  props.onChange(key);
                },
                children: () => content(o, props.option, s),
              });
            },
          }),
      }),
      Part({
        ...props.styles?.empty,
        id: `${id}.empty`,
        role: "status",
        children: () =>
          If({
            get when() {
              return l.open.get() && none.get();
            },
            children: () => Text({ as: "span", children: () => props.empty?.() ?? "" }),
          }),
      }),
    ],
  });
}
