import { type Infer, type KeelError, type Result, ok } from "@keel/schema";
import type { WorkflowStores } from "@keel/std-workflows";
import { tx } from "@keel/store";
import type { RestockData } from "./RestockData.schema.ts";
import { weeklyStaples } from "./weeklyStaples.ts";

const DAY = 86_400_000;

type Stores = { readonly restock: Pick<WorkflowStores<Infer<typeof RestockData>, never, string>, "store" | "start"> };

/**
 * Starts a weekly run with id `id`, unless one is still going, or `by` is the schedule and the schedule already started
 * one on the same UTC day (a start job that runs again after a crash). Answers whether it started one.
 */
export function startRun(
  stores: Stores,
  p: { id: string; by: "schedule" | "member"; at: number },
): Result<boolean, KeelError<string, unknown>> {
  const all = Object.values(stores.restock.store.get("instances"));
  if (all.some((i) => i.state === "putting" || i.state === "resting")) return ok(false);
  const day = Math.floor(p.at / DAY);
  if (p.by === "schedule" && all.some((i) => i.data.by === "schedule" && Math.floor(i.data.at / DAY) === day))
    return ok(false);
  const data = { staples: weeklyStaples, next: 0, putBack: 0, by: p.by, at: p.at, code: "" };
  const r = tx(stores.restock.start, { id: p.id, data });
  return r.ok ? ok(true) : r;
}
