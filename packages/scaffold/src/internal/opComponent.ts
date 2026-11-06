import type { Result } from "@keel/schema";
import { componentTest } from "../templates/componentTest.ts";
import { componentTsx } from "../templates/componentTsx.ts";
import type { Edit } from "../types/Edit.ts";
import type { ScaffoldError } from "../types/ScaffoldError.ts";
import type { Writes } from "./Writes.ts";
import { badInput } from "./badInput.ts";
import { basenames } from "./basenames.ts";
import { commit } from "./commit.ts";
import { fail } from "./fail.ts";
import { inputs } from "./inputs.ts";
import { isLowerCamel } from "./isLowerCamel.ts";
import { isPascal } from "./isPascal.ts";
import { targetsGenerated } from "./targetsGenerated.ts";

/** `scaffold component <module>/<Name>`: `<Name>.tsx` with a `Props` schema, and its property test. */
export function opComponent(input: unknown, files: ReadonlyMap<string, string>): Result<Edit, ScaffoldError> {
  const r = inputs.component.parse(input);
  if (!r.ok) return badInput("component", r.error);
  const { id } = r.value;
  if (targetsGenerated(id)) return fail("E1005", id, `${id} is a generated location`);
  const cut = id.lastIndexOf("/");
  const mod = id.slice(0, cut);
  const name = id.slice(cut + 1);
  if (cut < 0 || !isLowerCamel(mod)) return fail("E1352", id, `component id ${id} must be <module>/<Name>`);
  if (!files.has(`modules/${mod}/module.ts`)) return fail("E1352", id, `${mod} is not a module of this project`);
  if (!isPascal(name)) return fail("E1352", id, `component name ${name} must be PascalCase`);
  const file = `modules/${mod}/${name}.tsx`;
  const test = `modules/${mod}/${name}.test.tsx`;
  const existing = [...basenames(files, `${name}.tsx`), ...(files.has(test) ? [test] : [])];
  if (existing[0] !== undefined)
    return fail("E1351", existing[0], `component ${name} already exists; use codemod rename or move`);
  const writes: Writes = new Map([
    [file, componentTsx(name)],
    [test, componentTest(name)],
  ]);
  return commit(files, writes);
}
