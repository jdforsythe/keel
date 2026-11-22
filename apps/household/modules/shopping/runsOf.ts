import type { Infer } from "@keel/schema";
import type { RestockData } from "./RestockData.schema.ts";
import type { Runs } from "./Runs.schema.ts";

type Instance = { readonly state: string; readonly data: Infer<typeof RestockData> };

/** The runs a member sees, from the workflow store's instances: the one started last, and how many are kept. */
export function runsOf(instances: Readonly<Record<string, Instance>>): Infer<typeof Runs> {
  const all = Object.values(instances).sort((a, b) => (a.data.at < b.data.at ? 1 : a.data.at > b.data.at ? -1 : 0));
  const [last] = all;
  if (last === undefined) return { last: null, kept: 0 };
  const state = last.state === "done" ? "done" : last.state === "failed" ? "failed" : "running";
  const total = last.data.staples.length;
  return {
    last: {
      by: last.data.by,
      at: last.data.at,
      state,
      putBack: last.data.putBack,
      handled: state === "done" ? total : last.data.next,
      total,
      code: last.data.code,
    },
    kept: all.length,
  };
}
