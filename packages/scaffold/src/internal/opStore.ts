import type { Result } from "@keel/schema";
import { stateSchemaTs } from "../templates/stateSchemaTs.ts";
import { storeTest } from "../templates/storeTest.ts";
import { storeTs } from "../templates/storeTs.ts";
import type { Edit } from "../types/Edit.ts";
import type { ScaffoldError } from "../types/ScaffoldError.ts";
import type { Writes } from "./Writes.ts";
import { badInput } from "./badInput.ts";
import { commit } from "./commit.ts";
import { fail } from "./fail.ts";
import { inputs } from "./inputs.ts";
import { pascal } from "./pascal.ts";
import { storeId } from "./storeId.ts";
import { targetsGenerated } from "./targetsGenerated.ts";

/** `scaffold store <module>.<name>`: `<Name>State.schema.ts`, `<name>.store.ts`, and its invariant test. */
export function opStore(input: unknown, files: ReadonlyMap<string, string>): Result<Edit, ScaffoldError> {
  const r = inputs.store.parse(input);
  if (!r.ok) return badInput("store", r.error);
  const { id } = r.value;
  if (targetsGenerated(id)) return fail("E1005", id, `${id} is a generated location`);
  const sid = storeId(id);
  if (sid === null) return fail("E1352", id, `store id ${id} must be <module>.<name>, both lowerCamel`);
  const { mod, name } = sid;
  if (!files.has(`modules/${mod}/module.ts`)) return fail("E1352", id, `${mod} is not a module of this project`);
  const schema = `${pascal(name)}State`;
  const dir = `modules/${mod}`;
  const inTestDir = files.has("vitest.config.ts");
  const test = inTestDir ? `test/${mod}.${name}.store.test.ts` : `${dir}/${name}.store.test.ts`;
  const paths = [`${dir}/${schema}.schema.ts`, `${dir}/${name}.store.ts`, test];
  for (const p of paths) if (files.has(p)) return fail("E1351", p, `store ${id} already exists; use a codemod`);
  const [schemaPath = "", storePath = "", testPath = ""] = paths;
  const writes: Writes = new Map([
    [schemaPath, stateSchemaTs(schema)],
    [storePath, storeTs(name, schema)],
    [testPath, storeTest(name, schema, inTestDir ? `../${dir}` : ".")],
  ]);
  return commit(files, writes);
}
