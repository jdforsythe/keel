import { s } from "@keel/schema";

/** The schema of a statement that returns no rows (std.postgres): a closed empty object, so any row fails it. `run` takes `sql(NoRows)`. */
export const NoRows = s.object({}, { closed: true });
export type NoRows = s.infer<typeof NoRows>;
