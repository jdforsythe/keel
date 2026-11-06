import type { SourceFile } from "./SourceFile.ts";

/**
 * Everything `run` may read. The engine never touches the process: the binary fills `files` from disk,
 * tests pass them directly. `tty` and `env.KEEL_AGENT` select the default format (OUTPUT.md).
 */
export type Io = {
  readonly cwd: string;
  readonly files?: readonly SourceFile[] | undefined;
  readonly stdin?: string | undefined;
  readonly env?: Readonly<Record<string, string>> | undefined;
  readonly tty?: boolean | undefined;
};
