import { inspector } from "@keel/compiler/inspect/inspector";
import type { KeyValueStorage } from "@keel/ctx";
import { WorkflowsInstances } from "../WorkflowsInstances.ts";

const seen = new WeakMap<KeyValueStorage, Record<string, Readonly<Record<string, number>>>>();

inspector({ id: "workflows.instances", schema: WorkflowsInstances, read: (ctx) => ({ ...seen.get(ctx.storage) }) });

/** Record what `workflows.instances` shows for workflow `id` after a scan: a count per state, never `data`. */
export function counted(storage: KeyValueStorage, id: string, counts: Readonly<Record<string, number>>): void {
  seen.set(storage, { ...seen.get(storage), [id]: counts });
}
