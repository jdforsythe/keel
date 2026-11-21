import { s } from "@keel/schema";

/** Search of `sessions.list`: only fingerprints whose sessions failed (`failing`), and `last >= since`. */
export const ListSearch = s.object({ failing: s.boolean().optional(), since: s.number().optional() });
export type ListSearch = s.infer<typeof ListSearch>;
