import type { FlowInput } from "./FlowInput.schema.ts";

/** One job a scan enqueues: its job id, input, std.jobs key `<id>:<flow>:<entered>` and delay. */
export type Plan = { readonly job: string; readonly input: FlowInput; readonly key: string; readonly delayMs: number };
