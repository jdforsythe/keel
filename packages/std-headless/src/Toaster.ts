import type { Ctx } from "@keel/ctx";
import { owner } from "@keel/reactive";
import { For } from "@keel/runtime-dom";
import { instance } from "@keel/std-statecharts";
import { tx } from "@keel/store";
import { Box } from "@keel/ui";
import { Part, type PartStyle } from "@keel/ui/aria";
import type { ToastItem } from "./ToastItem.ts";
import { checkKeys } from "./internal/checkKeys.ts";
import { untracked } from "./internal/untracked.ts";
import { toastChart } from "./toastChart.ts";

const LEAST = 5000;

/**
 * Live regions for short messages (std.headless, WCAG 4.1.3). Parts `status` and `alert`, rendered from the first
 * render; each item is `toast.<id>` in the region of its tone with the button `dismiss.<id>`. A `status` item expires
 * `duration` ms (at least 5,000) after it shows, counted on `ctx.clock`; focus inside it holds it, and leaving starts
 * the full duration again. An `alert` item stays until dismissed. When an item is gone `onDismiss(id)` is called once.
 */
export function Toaster(
  props: {
    readonly id: string;
    readonly items: () => readonly ToastItem[];
    readonly onDismiss: (id: string) => void;
    readonly dismiss: string;
    readonly duration?: number;
    readonly styles?: {
      readonly status?: PartStyle;
      readonly alert?: PartStyle;
      readonly toast?: PartStyle;
      readonly dismiss?: PartStyle;
    };
  },
  _slots?: undefined,
  ctx?: Ctx,
): Node {
  const id = props.id;
  const items = () => {
    const xs = props.items();
    checkKeys(
      id,
      xs.map((i) => i.id),
    );
    return xs;
  };
  untracked(items);
  // An instance's key is a counter, never the item's id: no app value enters a chart's store id or log.
  let made = 0;
  const toast = (item: ToastItem): Node => {
    made += 1;
    const c = instance(toastChart, `${id}.${made}`);
    let timer: AbortController | undefined;
    let told = false;
    const after = () => {
      if (told || c.store.get("state") !== "gone") return;
      told = true;
      timer?.abort();
      props.onDismiss(item.id);
    };
    const start = () => {
      timer?.abort();
      if (item.tone !== "status" || props.duration === undefined || ctx === undefined) return;
      const run = new AbortController();
      timer = run;
      ctx.clock.after(Math.max(LEAST, props.duration), run.signal).then(
        () => {
          tx(c.events.expire, {});
          after();
        },
        () => undefined,
      );
    };
    start();
    owner()?.onDispose(() => timer?.abort());
    const part = `${id}.toast.${item.id}`;
    return Part({
      ...props.styles?.toast,
      id: part,
      role: "generic",
      children: () => [
        item.text,
        Part({
          ...props.styles?.dismiss,
          id: `${id}.dismiss.${item.id}`,
          role: "button",
          controls: part,
          onFocus: () => {
            timer?.abort();
            tx(c.events.pause, {});
          },
          onBlur: () => {
            tx(c.events.resume, {});
            if (c.store.get("state") === "showing") start();
          },
          onClick: () => {
            tx(c.events.dismiss, {});
            after();
          },
          children: () => props.dismiss,
        }),
      ],
    });
  };
  const region = (tone: ToastItem["tone"]) =>
    Part({
      ...props.styles?.[tone],
      id: `${id}.${tone}`,
      role: tone,
      children: () =>
        For({
          get each() {
            return items().filter((i) => i.tone === tone);
          },
          key: "id",
          children: toast,
        }),
    });
  return Box({ children: () => [region("status"), region("alert")] });
}
