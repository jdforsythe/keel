import type { Danger } from "./Danger.ts";
import type { Loud } from "./Loud.ts";
import type { Novelty } from "./Novelty.ts";

/** The `review` record (k.review Findings; OUTPUT.md). */
export type ReviewRecord = {
  readonly kind: "review";
  readonly code: string;
  readonly path: string;
  readonly line: number;
  readonly col: number;
  readonly message: string;
  readonly protection: string;
  readonly opt: boolean;
  readonly danger: Danger;
  readonly novelty: Novelty;
  readonly loud: Loud;
  readonly id: string;
  readonly reason?: string;
};
