import { type ObjectSchema, type Result, type SchemaError, s } from "@keel/schema";

const LOWER_CAMEL = /^[a-z][A-Za-z0-9]*$/;

const shape = s.object({
  id: s.string({ min: 1, max: 60 }),
  deps: s.array(s.string({ min: 1 })),
  capabilities: s.array(s.string({ min: 1 })),
  public: s.object({ exports: s.array(s.string({ min: 1 })) }, { closed: true }),
  std: s.record(s.json()).optional(),
  clientPii: s
    .array(s.enum(["name", "contact", "location", "identifier", "financial", "special", "network", "content"]))
    .optional(),
});

type Manifest = typeof shape extends ObjectSchema<infer T> ? T : never;

/** The `id` rule the base schema cannot express: lowerCamel (k.module). Reported as a `type` issue at `id`. */
function lowerCamel(r: Result<Manifest, SchemaError>): Result<Manifest, SchemaError> {
  if (!r.ok || LOWER_CAMEL.test(r.value.id)) return r;
  const issues: SchemaError["data"]["issues"] = [{ path: ["id"], rule: "type" }];
  const message = `id ${JSON.stringify(r.value.id.slice(0, 30))} is not lowerCamel`;
  return { ok: false, error: { code: "schema.invalid", message, data: { issues } } };
}

/**
 * Schema of a module manifest (k.module): `id` (lowerCamel, equals the folder name), `deps` (app module ids or
 * stdlib package names), `capabilities` (ctx capability names), the `public` surface (a closed
 * object of export names only: a module's public routes are its contract's entries, k.contract), and
 * optional `std` config per stdlib package (JSON values, checked against each package's schema by E1158), and optional
 * `clientPii`, the `.pii()` classes its client-reachable stores may hold (k.leave Snapshots, E1107).
 * App and stdlib manifests use this one schema.
 */
export const ModuleSchema: ObjectSchema<Manifest> = {
  ...shape,
  parse: (input) => lowerCamel(shape.parse(input)),
  decodeStrings: (input) => lowerCamel(shape.decodeStrings(input)),
  encode(value) {
    const r = lowerCamel(shape.parse(value));
    if (!r.ok) throw new Error(`module manifest: ${r.error.message}`);
    return shape.encode(value);
  },
};
