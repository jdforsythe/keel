import type { Instance } from "./Instance.ts";

/** A workflow store's state (std.workflows): every instance by its `Id<'Flow'>`. */
export type Instances<S extends string, D> = { instances: Record<string, Instance<S, D>> };
