import type { A11yEntry } from "../types/A11yEntry.ts";

/** One intrinsic element in source, with its stable id and what the artifacts record about it. */
export type ElementInfo = {
  id: string;
  explicit: boolean;
  start: number;
  file: string;
  line: number;
  col: number;
  component: string;
  tag: string;
  role: string | null;
  name: A11yEntry["name"];
};
