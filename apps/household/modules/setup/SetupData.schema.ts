import { s } from "@keel/schema";
import { line } from "@keel/std-text";

export const SetupData = s.object({
  heading: s.string(),
  intro: s.string(),
  name: s.string(),
  save: s.string(),
  current: line({ max: 40 }).nullable(),
  done: s.string(),
});
