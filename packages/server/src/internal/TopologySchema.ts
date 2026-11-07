import { s } from "@keel/schema";

/**
 * Shape of a topology definition: deployable name -> `{ modules, adapter }` (k.server). Internal (RFC 0046): only
 * `topology()` parses with it, adding the checks the shape cannot state (a deployable has modules).
 */
export const TopologySchema = s.record(
  s.object({
    modules: s.array(s.string({ min: 1 })),
    adapter: s.enum(["node", "static", "client"]),
  }),
);
