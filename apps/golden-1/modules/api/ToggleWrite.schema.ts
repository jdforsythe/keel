import { s } from "@keel/schema";
import { Write } from "@keel/std-offline";

/** Body of `POST /api/todos/:todoId/toggle`: the write's `key` and `base`. */
export const ToggleWrite = s.object({ write: Write });
export type ToggleWrite = s.infer<typeof ToggleWrite>;
