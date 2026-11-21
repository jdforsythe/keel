import { s } from "@keel/schema";

/** A workflow job's input (std.workflows): the instance's id and its `entered`, never its `data`. */
export const FlowInput = s.object({ id: s.string({ min: 1 }), entered: s.int({ min: 0 }) }, { closed: true });
export type FlowInput = s.infer<typeof FlowInput>;
