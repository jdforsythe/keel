import type { Ctx } from "@keel/ctx";
import { computed } from "@keel/reactive";
import { instance } from "@keel/std-statecharts";
import { tx } from "@keel/store";
import { Box, type Child, Heading, Text } from "@keel/ui";
import { type KeyInput, Part, type PartStyle } from "@keel/ui/aria";
import { openChart } from "./openChart.ts";

/**
 * A modal dialog opened by a button (std.headless, APG Dialog (Modal)). Parts `trigger`, `dialog`, `title` and, with
 * `alert`, `description` (the dialog is then an `alertdialog`). A click, Enter or Space on the trigger opens it and
 * focuses its first control; Escape or `close` closes it and focuses the trigger again.
 */
export function Dialog(
  props: {
    readonly id: string;
    readonly title: string;
    readonly level?: 2 | 3 | 4 | 5 | 6;
    readonly trigger: () => Child;
    readonly content: (close: () => void) => Child;
    readonly alert?: { readonly description: string };
    readonly styles?: { readonly trigger?: PartStyle; readonly dialog?: PartStyle };
  },
  _slots?: undefined,
  _ctx?: Ctx,
): Node {
  const id = props.id;
  const c = instance(openChart, id);
  const open = () => tx(c.events.open, {});
  const close = () => tx(c.events.close, {});
  const onTrigger = (k: KeyInput): boolean => {
    if (k.key !== "Enter" && k.key !== " ") return false;
    open();
    return true;
  };
  const onDialog = (k: KeyInput): boolean => {
    if (k.key !== "Escape") return false;
    close();
    return true;
  };
  const alert = props.alert;
  const body = () => [
    Heading({ id: `${id}.title`, level: props.level ?? 2, children: computed(() => props.title) }),
    alert === undefined
      ? []
      : Text({ id: `${id}.description`, children: computed(() => props.alert?.description ?? "") }),
    props.content(close),
  ];
  const common = {
    ...props.styles?.dialog,
    id: `${id}.dialog`,
    labelledBy: `${id}.title`,
    returnFocus: `${id}.trigger`,
    open: computed(() => c.store.get("state") === "open"),
    onKey: onDialog,
    onDismiss: close,
    children: body,
  };
  return Box({
    children: () => [
      Part({
        ...props.styles?.trigger,
        id: `${id}.trigger`,
        role: "button",
        hasPopup: "dialog",
        onClick: open,
        onKey: onTrigger,
        children: props.trigger,
      }),
      alert === undefined
        ? Part({ ...common, role: "dialog" })
        : Part({ ...common, role: "alertdialog", describedBy: `${id}.description` }),
    ],
  });
}
