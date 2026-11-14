import { s } from "@keel/schema";

const Shell = s.object({ id: s.string(), name: s.string() });

/**
 * Shape of a topology definition: deployable name -> `{ modules, adapter, host?, storage?, shells? }` (k.topology). Internal: only
 * `topology()` parses with it, adding the checks the shape cannot state (a deployable has modules).
 */
export const TopologySchema = s.record(
  s.object({
    modules: s.array(s.string({ min: 1 })),
    adapter: s.enum(["node", "static", "client"]),
    host: s.string({ min: 1 }).optional(),
    storage: s.enum(["file", "sqlite", "postgres"]).optional(),
    shells: s.object({ capacitor: Shell.optional(), tauri: Shell.optional() }).optional(),
  }),
);
