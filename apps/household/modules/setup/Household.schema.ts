import { s } from "@keel/schema";
import { line } from "@keel/std-text";

export const Household = s.object({ name: line({ max: 40 }).nullable() });
