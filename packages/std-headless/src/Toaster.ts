import type { Ctx } from "@keel/ctx";
import { computed, owner } from "@keel/reactive";
import { For } from "@keel/runtime-dom";
import { attempt } from "@keel/schema";
import { instance } from "@keel/std-statecharts";
import { Box } from "@keel/ui";
import { Part, type PartStyle } from "@keel/ui/aria";
import type { ToastItem } from "./ToastItem.ts";
import { Cancelled } from "./internal/Cancelled.schema.ts";
import { checkKeys } from "./internal/checkKeys.ts";
import { send } from "./internal/send.ts";
import { toastKey } from "./internal/toastKey.ts";
import { stableRows } from "./stableRows.ts";
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
  ctx: Ctx,
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
  items();
  // An instance's key is the lowest slot no live toast holds, never the item's id: no app value enters a chart's
  // store id or log, and the key stays short however many toasts have shown.
  const live = new Set<number>();
  const toast = (tone: ToastItem["tone"], key: string): Node => {
    const text = computed(() => items().find((i) => i.id === key)?.text ?? "");
    let slot = 0;
    while (live.has(slot)) slot += 1;
    live.add(slot);
    owner()?.onDispose(() => live.delete(slot));
    const c = instance(toastChart, toastKey(id, slot));
    let timer: AbortController | undefined;
    let told = false;
    const after = () => {
      if (told || c.store.get("state") !== "gone") return;
      told = true;
      timer?.abort();
      props.onDismiss(key);
    };
    const start = () => {
      timer?.abort();
      if (tone !== "status" || props.duration === undefined) return;
      const run = new AbortController();
      timer = run;
      const duration = props.duration;
      const waiting = ctx.clock.after(Math.max(LEAST, duration), run.signal);
      void attempt(
        () => waiting,
        (x) => (x === run.signal.reason ? Cancelled.make({}) : undefined),
      ).then((waited) => {
        if (!waited.ok) return;
        send(c.events.expire, {});
        after();
      });
    };
    start();
    owner()?.onDispose(() => timer?.abort());
    const part = `${id}.toast.${key}`;
    return Part({
      ...props.styles?.toast,
      id: part,
      role: "generic",
      children: () => [
        text,
        Part({
          ...props.styles?.dismiss,
          id: `${id}.dismiss.${key}`,
          role: "button",
          controls: part,
          onFocus: () => {
            timer?.abort();
            send(c.events.pause, {});
          },
          onBlur: () => {
            send(c.events.resume, {});
            if (c.store.get("state") === "showing") start();
          },
          onClick: () => {
            send(c.events.dismiss, {});
            after();
          },
          children: () => computed(() => props.dismiss),
        }),
      ],
    });
  };
  const region = (tone: ToastItem["tone"]) => {
    // One row per item id, kept while the id is listed: a new text shows in place and the item's timer runs on.
    const rows = stableRows(
      () => items().filter((i) => i.tone === tone),
      (i) => i.id,
    );
    return Part({
      ...props.styles?.[tone],
      id: `${id}.${tone}`,
      role: tone,
      children: () =>
        For({
          get each() {
            return rows.get();
          },
          key: "key",
          children: (row) => toast(tone, row.key),
        }),
    });
  };
  return Box({ id: `${id}.root`, children: () => [region("status"), region("alert")] });
}
