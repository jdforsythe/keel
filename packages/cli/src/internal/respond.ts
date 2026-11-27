import type { Io } from "../types/Io.ts";
import type { Mode } from "../types/Mode.ts";
import type { OutRecord } from "../types/OutRecord.ts";
import type { RunResult } from "../types/RunResult.ts";
import { defaultMode } from "./defaultMode.ts";
import { exitCode } from "./exitCode.ts";
import { keelForm } from "./keelForm.ts";
import { normalize } from "./normalize.ts";
import { render } from "./render.ts";

type Flags = {
  readonly command: string;
  readonly format?: Mode | undefined;
  readonly quiet?: boolean | undefined;
  readonly limit?: number | undefined;
  readonly verbose?: boolean | undefined;
  readonly code?: string | undefined;
};

/** Turn a command's records into the process result: normalize (E1054), exit code, render per flags. */
export function respond(
  records: readonly OutRecord[],
  io: Io,
  flags: Flags,
): RunResult & { readonly records: readonly OutRecord[] } {
  const all = normalize(records);
  const stdout = render(all, {
    mode: flags.format ?? defaultMode(io),
    quiet: flags.quiet === true,
    limit: flags.limit,
    verbose: flags.verbose === true,
    code: flags.code,
    command: flags.command,
    keel: keelForm(io.env?.npm_config_user_agent),
  });
  return { code: exitCode(all), stdout, stderr: "", records: all };
}
