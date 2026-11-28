import type { Result } from "@keel/schema";
import { stateSchemaTs } from "../templates/stateSchemaTs.ts";
import { transactionTest } from "../templates/transactionTest.ts";
import { transactionTs } from "../templates/transactionTs.ts";
import type { Edit } from "../types/Edit.ts";
import type { ScaffoldError } from "../types/ScaffoldError.ts";
import type { Writes } from "./Writes.ts";
import { badInput } from "./badInput.ts";
import { commit } from "./commit.ts";
import { fail } from "./fail.ts";
import { inputs } from "./inputs.ts";
import { isLowerCamel } from "./isLowerCamel.ts";
import { pascal } from "./pascal.ts";
import { targetsGenerated } from "./targetsGenerated.ts";

/**
 * `scaffold transaction <module>.<store>.<name>`: `<Name>Payload.schema.ts`, `<name>.transaction.ts` on the store
 * `<module>.<store>` of a module of the project (else E1052, an unknown target), which must exist, else E1052 printing the line that makes
 * it, and its 100-run invariant property test.
 */
export function opTransaction(input: unknown, files: ReadonlyMap<string, string>): Result<Edit, ScaffoldError> {
  const r = inputs.transaction.parse(input);
  if (!r.ok) return badInput("transaction", r.error);
  const { id } = r.value;
  if (targetsGenerated(id)) return fail("E1005", id, `${id} is a generated location`);
  const segs = id.split(".");
  const [mod = "", store = "", name = ""] = segs;
  if (segs.length !== 3 || !segs.every(isLowerCamel))
    return fail("E1352", id, `transaction id ${id} must be <module>.<store>.<name>, each lowerCamel`);
  const dir = `modules/${mod}`;
  if (!files.has(`${dir}/module.ts`)) return fail("E1052", id, `${mod} is not a module of this project`);
  if (!files.has(`${dir}/${store}.store.ts`))
    return fail("E1052", id, `transaction needs a store first: keel scaffold store ${mod}.${store}`);
  const schema = `${pascal(name)}Payload`;
  const inTestDir = files.has("vitest.config.ts");
  const test = inTestDir ? `test/${id}.transaction.test.ts` : `${dir}/${name}.transaction.test.ts`;
  const paths = [`${dir}/${schema}.schema.ts`, `${dir}/${name}.transaction.ts`, test];
  for (const p of paths) if (files.has(p)) return fail("E1351", p, `transaction ${id} already exists; use a codemod`);
  const [schemaPath = "", txPath = "", testPath = ""] = paths;
  const writes: Writes = new Map([
    [schemaPath, stateSchemaTs(schema)],
    [txPath, transactionTs(id, store, name, schema)],
    [testPath, transactionTest(name, inTestDir ? `../${dir}` : ".")],
  ]);
  return commit(files, writes);
}
