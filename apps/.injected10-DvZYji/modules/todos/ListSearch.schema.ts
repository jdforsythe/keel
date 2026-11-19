import { s } from "@keel/schema";

/** Search of `todos.list`: which todos the page shows. */
export const ListSearch = s.object({ filter: s.enum(["all", "active", "done"]).optional() });
export type ListSearch = s.infer<typeof ListSearch>;
