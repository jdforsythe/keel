import type { Mode } from "../types/Mode.ts";

/** Rendering controls shared by every command (OUTPUT.md). `command` names the `... +K more` hint. */
export type RenderOptions = {
  readonly mode: Mode;
  readonly quiet: boolean;
  readonly limit: number | undefined;
  readonly verbose: boolean;
  readonly code: string | undefined;
  readonly command: string;
  /** How the reader runs `keel` (`pnpm keel`), which compact and pretty print in place of a bare `keel <command>`. */
  readonly keel?: string | undefined;
};
