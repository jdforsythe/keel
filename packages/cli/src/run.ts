import { codeFilter } from "./internal/codeFilter.ts";
import { execute } from "./internal/execute.ts";
import { parseArgv } from "./internal/parseArgv.ts";
import { respond } from "./internal/respond.ts";
import { usageResult } from "./internal/usageResult.ts";
import { lsp } from "./lsp.ts";
import { mcp } from "./mcp.ts";
import { operations } from "./operations.ts";
import type { Io } from "./types/Io.ts";
import type { RunResult } from "./types/RunResult.ts";

/**
 * The engine: run one `keel` command in-process. Pure over `io` (no fs, no process); the `keel` binary wraps it.
 * `mcp` and `lsp` serve their protocol over `io.stdin` and return the replies as stdout.
 */
export async function run(argv: readonly string[], io: Io): Promise<RunResult> {
  const head = argv[0];
  if (head === "mcp" || head === "lsp") {
    const extra = argv.slice(1);
    if (extra.length > 0) {
      const shown = (extra[0] ?? "").slice(0, 30);
      const r = usageResult(
        head,
        [{ kind: "diag", code: "E1052", message: `${head} takes no arguments: ${shown}`, see: "k.cli" }],
        io,
        undefined,
      );
      return { code: r.code, stdout: r.stdout, stderr: r.stderr };
    }
    const stdin = io.stdin ?? "";
    if (head === "lsp") return { code: 0, stdout: await lsp(() => io).receive(stdin), stderr: "" };
    const lines = stdin === "" || stdin.endsWith("\n") ? stdin : `${stdin}\n`;
    return { code: 0, stdout: await mcp(() => io).receive(lines), stderr: "" };
  }
  const parsed = parseArgv(argv, operations);
  if (!parsed.ok) {
    const r = usageResult(parsed.command, parsed.diags, io, parsed.format);
    return { code: r.code, stdout: r.stdout, stderr: r.stderr };
  }
  const { op, input } = parsed;
  const records = await execute(op, input, io);
  const r = respond(records, io, { ...input, command: op.name, code: codeFilter(op, input) });
  return { code: r.code, stdout: r.stdout, stderr: r.stderr };
}
