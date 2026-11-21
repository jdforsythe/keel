import { s } from "@keel/schema";

const Pairs = s.record(s.string());
const Origins = s.object({
  img: Pairs.optional(),
  media: Pairs.optional(),
  font: Pairs.optional(),
  connect: Pairs.optional(),
  frame: Pairs.optional(),
});
const Shell = s.object({ id: s.string(), name: s.string() });

/**
 * Shape of a topology definition: deployable name -> `{ modules, adapter, servedBy?, storage?, shells?, caller?, origins? }` (k.topology); a key it does not list is E1552. Internal: only
 * `topology()` parses with it, adding the checks the shape cannot state (a deployable has modules).
 */
export const TopologySchema = s.record(
  s.object(
    {
      modules: s.array(s.string({ min: 1 })),
      adapter: s.enum(["node", "static", "client"]),
      servedBy: s.string({ min: 1 }).optional(),
      storage: s.enum(["file", "sqlite", "postgres"]).optional(),
      shells: s.object({ capacitor: Shell.optional(), tauri: Shell.optional() }).optional(),
      caller: s.object({ days: s.int({ min: 1, max: 400 }) }).optional(),
      origins: Origins.optional(),
    },
    { closed: true },
  ),
);
