import { type Ctx, observe } from "@keel/ctx";
import { attempt } from "@keel/schema";
import type { FlowQueue } from "../FlowQueue.ts";
import { Cancelled } from "./Cancelled.ts";
import type { Planned } from "./Planned.ts";
import { counted } from "./counted.ts";
import { planKey } from "./planKey.ts";

const POLL_MS = 60_000;

/**
 * The `flows` runner (std.workflows Run): at start, after each `save` of one of its workflow stores and every 60,000 ms
 * of `ctx.clock`, read each store and enqueue its instances' jobs; a key it enqueued in the last scan is not sent again.
 */
export async function runFlows(
  ctx: Ctx,
  signal: AbortSignal,
  queue: FlowQueue,
  workflows: readonly Planned[],
): Promise<void> {
  const ids = new Set(workflows.map((w) => w.id));
  let nap = new AbortController();
  let dirty = false;
  const poke = (): void => {
    dirty = true;
    nap.abort();
  };
  const stop = observe(ctx, (e) => {
    if (e.kind === "save" && ids.has(e.store)) poke();
  });
  signal.addEventListener("abort", poke, { once: true });
  let sent = new Set<string>();
  try {
    while (!signal.aborted) {
      dirty = false;
      const now = new Set<string>();
      for (const w of workflows) {
        const scan = await w[planKey](ctx);
        if (scan === undefined) continue;
        counted(ctx.storage, w.id, scan.counts);
        for (const p of scan.plans) {
          if (signal.aborted) return;
          if (!sent.has(p.key)) {
            const r = await queue.enqueue(ctx, p.job, p.input, { key: p.key, delayMs: p.delayMs });
            if (!r.ok) continue;
          }
          now.add(p.key);
        }
      }
      sent = now;
      if (dirty || signal.aborted) continue;
      const wake = new AbortController();
      nap = wake;
      const napping = ctx.clock.after(POLL_MS, wake.signal);
      void (await attempt(
        () => napping,
        (x) => (x === wake.signal.reason ? Cancelled.make({}) : undefined),
      ));
    }
  } finally {
    stop();
    signal.removeEventListener("abort", poke);
  }
}
