import { s } from "@keel/schema";
import { line } from "@keel/std-text";
import { RestockText } from "../shopping/RestockText.schema.ts";
import { Runs } from "../shopping/Runs.schema.ts";

export const SetupData = s.object({
  heading: s.string({ min: 1 }),
  intro: s.string({ min: 1 }),
  name: s.string({ min: 1 }),
  save: s.string({ min: 1 }),
  current: line({ max: 40 }).nullable(),
  done: s.string({ min: 1 }),
  restock: RestockText,
  runs: Runs,
});
