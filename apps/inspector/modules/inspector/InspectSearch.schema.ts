import { s } from "@keel/schema";

/** Search of `inspector.index`: the origin of the app to inspect (default: the inspector's own). */
export const InspectSearch = s.object({ url: s.string().optional() });
export type InspectSearch = s.infer<typeof InspectSearch>;
