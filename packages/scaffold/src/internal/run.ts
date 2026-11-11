import type { Result } from "@keel/schema";
import type { Edit } from "../types/Edit.ts";
import type { Op } from "../types/Op.ts";
import type { ScaffoldError } from "../types/ScaffoldError.ts";
import { fail } from "./fail.ts";
import { opAddField } from "./opAddField.ts";
import { opComponent } from "./opComponent.ts";
import { opModule } from "./opModule.ts";
import { opMove } from "./opMove.ts";
import { opPlace } from "./opPlace.ts";
import { opProject } from "./opProject.ts";
import { opRename } from "./opRename.ts";
import { opRoute } from "./opRoute.ts";
import { opService } from "./opService.ts";
import { opStore } from "./opStore.ts";
import { opTransaction } from "./opTransaction.ts";

type Impl = (input: unknown, files: ReadonlyMap<string, string>) => Result<Edit, ScaffoldError>;

const OPS: ReadonlyMap<string, Impl> = new Map<Op, Impl>([
  ["project", opProject],
  ["module", opModule],
  ["route", opRoute],
  ["component", opComponent],
  ["store", opStore],
  ["transaction", opTransaction],
  ["service", opService],
  ["rename", opRename],
  ["move", opMove],
  ["place", opPlace],
  ["add-field", opAddField],
]);

/** Compute one operation's edit set from the tree; pure, deterministic, never mutates `files`. */
export function run(
  op: Op,
  input: Readonly<Record<string, unknown>>,
  files: ReadonlyMap<string, string>,
): Result<Edit, ScaffoldError> {
  const impl = OPS.get(op);
  return impl === undefined
    ? fail("E1051", String(op), `unknown scaffold operation ${String(op)}`)
    : impl(input, files);
}
