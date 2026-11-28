import type { Result } from "@keel/schema";
import type { DeployShells } from "../types/DeployShells.ts";
import type { Edit } from "../types/Edit.ts";
import type { Op } from "../types/Op.ts";
import type { ScaffoldError } from "../types/ScaffoldError.ts";
import { fail } from "./fail.ts";
import { isLibrary } from "./isLibrary.ts";
import { opAddField } from "./opAddField.ts";
import { opComponent } from "./opComponent.ts";
import { opLibrary } from "./opLibrary.ts";
import { opModule } from "./opModule.ts";
import { opMove } from "./opMove.ts";
import { opPlace } from "./opPlace.ts";
import { opProject } from "./opProject.ts";
import { opRename } from "./opRename.ts";
import { opRoute } from "./opRoute.ts";
import { opService } from "./opService.ts";
import { opShell } from "./opShell.ts";
import { opStore } from "./opStore.ts";
import { opTransaction } from "./opTransaction.ts";

type Impl = (input: unknown, files: ReadonlyMap<string, string>, shells: DeployShells) => Result<Edit, ScaffoldError>;

const OPS: ReadonlyMap<string, Impl> = new Map<Op, Impl>([
  ["project", opProject],
  ["module", opModule],
  ["route", opRoute],
  ["component", opComponent],
  ["store", opStore],
  ["transaction", opTransaction],
  ["service", opService],
  ["shell", opShell],
  ["library", opLibrary],
  ["rename", opRename],
  ["move", opMove],
  ["place", opPlace],
  ["add-field", opAddField],
]);

/** The generators that write into an app's modules and topology, which a library does not have (k.scaffold Rules). */
const APP_ONLY: ReadonlySet<string> = new Set<Op>([
  "module",
  "route",
  "component",
  "store",
  "transaction",
  "service",
  "shell",
]);

/**
 * Compute one operation's edit set from the tree; pure, deterministic, never mutates `files`. In a library an app's
 * generator is E1052 saying what a library holds instead, before its input is judged, so it prints no example line.
 */
export function run(
  op: Op,
  input: Readonly<Record<string, unknown>>,
  files: ReadonlyMap<string, string>,
  shells: DeployShells = {},
): Result<Edit, ScaffoldError> {
  const impl = OPS.get(op);
  if (APP_ONLY.has(op) && isLibrary(files))
    return fail(
      "E1052",
      "package.json",
      "a library has no modules; write a component in src/ and export it from src/index.ts",
      undefined,
      undefined,
      "k.library-pack",
    );
  return impl === undefined
    ? fail("E1051", String(op), `unknown scaffold operation ${String(op)}`)
    : impl(input, files, shells);
}
