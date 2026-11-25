import { s } from "@keel/schema";

/** The `workflows.instances` inspect section (std.workflows): per workflow id, a count of instances per state; never `data`. */
export const WorkflowsInstances = s.record(s.record(s.int({ min: 0 })));
export type WorkflowsInstances = s.infer<typeof WorkflowsInstances>;
