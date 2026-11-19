import { s } from "@keel/schema";

/**
 * The payload of a removal step's `failed` event (`removalChart`): `workflows.attempts` when its attempts ran out
 * (std.workflows), else the code its step returned (`purge`, `restore`).
 */
export const StepFailure = s.object({ code: s.enum(["workflows.attempts", "api.purgeFailed", "api.restoreFailed"]) });
export type StepFailure = s.infer<typeof StepFailure>;
