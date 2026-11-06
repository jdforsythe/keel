import type { Result } from "@keel/schema";
import MagicString from "magic-string";
import type { ObjectExpression } from "oxc-parser";
import type { Edit } from "../types/Edit.ts";
import type { ScaffoldError } from "../types/ScaffoldError.ts";
import type { Writes } from "./Writes.ts";
import { appendProperty } from "./appendProperty.ts";
import { badInput } from "./badInput.ts";
import { commit } from "./commit.ts";
import { constructorSites } from "./constructorSites.ts";
import { fail } from "./fail.ts";
import { fieldType } from "./fieldType.ts";
import { findSchema } from "./findSchema.ts";
import { inputs } from "./inputs.ts";
import { isCode } from "./isCode.ts";
import { isGenerated } from "./isGenerated.ts";
import { isLowerCamel } from "./isLowerCamel.ts";
import { keyName } from "./keyName.ts";
import { literalOf } from "./literalOf.ts";
import { parseSource } from "./parseSource.ts";
import { schemaLocals } from "./schemaLocals.ts";
import { schemaObject } from "./schemaObject.ts";
import { sortedKeys } from "./sortedKeys.ts";

const hasKey = (obj: ObjectExpression, key: string): boolean => obj.properties.some((p) => keyName(p) === key);

/**
 * `codemod add-field <Schema> <field> <type> [--default <json>]`: add the field to the `s.object` shape and,
 * for a required field, `field: default` to every object literal that constructs the schema's value
 * (store initials, form `initial`s, typed fixtures). Required without a default while constructors
 * exist is E1354.
 */
export function opAddField(input: unknown, files: ReadonlyMap<string, string>): Result<Edit, ScaffoldError> {
  const r = inputs["add-field"].parse(input);
  if (!r.ok) return badInput("add-field", r.error);
  const { schema, field, type } = r.value;
  const def: unknown = typeof input === "object" && input !== null ? Reflect.get(input, "default") : undefined;
  const decls = findSchema(files, schema);
  const gen = decls.find(isGenerated);
  if (gen !== undefined) return fail("E1005", gen, `${schema} is declared in generated ${gen}; regenerate instead`);
  const decl = decls[0];
  if (decl === undefined) return fail("E1052", schema, `no schema ${schema} (export const ${schema} = s.object(...))`);
  if (!isLowerCamel(field)) return fail("E1352", decl, `field ${field} must be lowerCamel`);
  const ft = fieldType(type);
  if (ft === null) return fail("E1052", decl, `type ${type} is not string|number|int|boolean[.optional][.nullable]`);
  const lit = def === undefined ? null : literalOf(def);
  if (def !== undefined && lit === null) return fail("E1052", decl, `default for ${field} is not a JSON value`);

  const writes: Writes = new Map();
  let sites = 0;
  for (const path of sortedKeys(files.keys())) {
    const src = files.get(path);
    if (src === undefined || !isCode(path) || isGenerated(path)) continue;
    const program = parseSource(path, src);
    if (program === null) continue;
    const ms = new MagicString(src);
    if (path === decl) {
      const shape = schemaObject(program, schema);
      if (shape === null) continue;
      if (hasKey(shape, field)) return fail("E1351", decl, `${schema} already has a field ${field}`);
      appendProperty(ms, src, shape, `${field}: ${ft.expr}`);
    }
    const found = constructorSites(program, schemaLocals(files, path, program, decl, schema));
    sites += found.length;
    if (!ft.optional && lit !== null)
      for (const obj of found) if (!hasKey(obj, field)) appendProperty(ms, src, obj, `${field}: ${lit}`);
    const out = ms.toString();
    if (out !== src) writes.set(path, out);
  }
  if (!ft.optional && lit === null && sites > 0)
    return fail("E1354", decl, `${field} is required and ${sites} constructor(s) of ${schema} exist; pass a default`);
  return commit(files, writes);
}
