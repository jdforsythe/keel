import { inspector } from "@keel/compiler/inspect/inspector";
import type { KeyValueStorage } from "@keel/ctx";
import { JobsQueue } from "../JobsQueue.ts";
import type { State } from "./State.ts";

const snaps = new WeakMap<KeyValueStorage, JobsQueue>();

inspector({ id: "jobs.queue", schema: JobsQueue, read: (ctx) => ({ ...snaps.get(ctx.storage) }) });

/** Record what the `jobs.queue` section shows for `module` after a write: counts and failures, never an input. */
export function snapshot(storage: KeyValueStorage, module: string, st: State): void {
  const running = st.q.filter((x) => x.l).length;
  snaps.set(storage, {
    ...snaps.get(storage),
    [module]: {
      pending: st.q.length - running,
      running,
      failed: st.failed.map(({ id, job, code, at }) => ({ id, job, code, at })),
    },
  });
}
