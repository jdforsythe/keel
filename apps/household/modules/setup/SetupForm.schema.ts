import { s } from "@keel/schema";
import { line } from "@keel/std-text";

export const SetupForm = s.object({ name: line({ max: 40 }) });
