import type { A11yEntry } from "../types/A11yEntry.ts";

/**
 * One element in source, with its stable id and what the artifacts record about it: an intrinsic element, or
 * (`base: true`) a `@keel/ui` base element with a literal `id`, recorded by the DOM tag it renders (D33).
 */
export type ElementInfo = {
  id: string;
  explicit: boolean;
  base: boolean;
  start: number;
  file: string;
  line: number;
  col: number;
  component: string;
  tag: string;
  role: string | null;
  name: A11yEntry["name"];
};
