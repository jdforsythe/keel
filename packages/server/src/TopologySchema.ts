import { s } from "@keel/schema";

/** Shape of a topology definition: deployable name -> `{ modules, adapter }` (k.server). */
export const TopologySchema = s.record(
  s.object({
    modules: s.array(s.string({ min: 1 })),
    adapter: s.enum(["node", "static", "client"]),
  }),
);
