import type { CreateRecord } from "./CreateRecord.ts";

/** What `createPlan` returns (k.create Package): the files to write, keyed from the folder, and the records to print. */
export type CreatePlan = {
  readonly files: Map<string, string>;
  readonly records: readonly CreateRecord[];
};
