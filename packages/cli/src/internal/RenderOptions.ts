import type { Mode } from "../types/Mode.ts";

/** Rendering controls shared by every command (OUTPUT.md). `command` names the `... +K more` hint. */
export type RenderOptions = {
  readonly mode: Mode;
  readonly quiet: boolean;
  readonly limit: number | undefined;
  readonly verbose: boolean;
  readonly code: string | undefined;
  readonly command: string;
};
