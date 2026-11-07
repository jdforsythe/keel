import { s } from "@keel/schema";

/** Input schema per operation (k.scaffold CLI flags). `add-field`'s `default` is any JSON value, read separately. */
export const inputs = {
  project: s.object({
    name: s.string(),
    adapter: s.enum(["client", "node", "static"]).optional(),
    workspace: s.boolean().optional(),
  }),
  module: s.object({ id: s.string() }),
  route: s.object({ id: s.string(), path: s.string(), file: s.string().optional() }),
  component: s.object({ id: s.string() }),
  store: s.object({ id: s.string() }),
  transaction: s.object({ id: s.string() }),
  service: s.object({ id: s.string(), schema: s.string(), service: s.string() }),
  rename: s.object({
    kind: s.enum(["component", "store", "route", "schema", "module"]),
    from: s.string(),
    to: s.string(),
  }),
  move: s.object({ name: s.string(), to: s.string() }),
  "add-field": s.object({ schema: s.string(), field: s.string(), type: s.string() }),
};
