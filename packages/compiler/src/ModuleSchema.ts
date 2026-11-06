import { s } from "@keel/schema";

/**
 * Schema of a module manifest (k.module): `id` (lowerCamel, equals the folder name), `deps` (app module ids or
 * stdlib package names), `capabilities` (ctx capability names), and the `public` surface (export names, route ids).
 */
export const ModuleSchema = s.object({
  id: s.string({ min: 1, max: 60 }),
  deps: s.array(s.string({ min: 1 })),
  capabilities: s.array(s.string({ min: 1 })),
  public: s.object({ exports: s.array(s.string({ min: 1 })), routes: s.array(s.string({ min: 1 })) }),
});
