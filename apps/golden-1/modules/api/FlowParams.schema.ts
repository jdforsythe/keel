import { s } from "@keel/schema";

/** Route params naming one removal instance (`api.undoRemoval`). */
export const FlowParams = s.object({ flow: s.string({ min: 1 }) });
export type FlowParams = s.infer<typeof FlowParams>;
