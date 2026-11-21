import type { Danger } from "./Danger.ts";

/** One escape at one revision, placed and identified (k.review Findings), before its novelty. */
export type Found = {
  readonly code: string;
  readonly path: string;
  readonly line: number;
  readonly col: number;
  readonly message: string;
  readonly protection: string;
  readonly opt: boolean;
  readonly danger: Danger;
  readonly id: string;
  readonly reason?: string;
};
