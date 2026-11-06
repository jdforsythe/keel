import { runEngine } from "./internal/runEngine.ts";
import { usageResult } from "./internal/usageResult.ts";
import { lsp } from "./lsp.ts";
import { mcp } from "./mcp.ts";
import type { Io } from "./types/Io.ts";
import type { RunResult } from "./types/RunResult.ts";

/**
 * The engine: run one `keel` command in-process. Pure over `io` (no fs, no process; `keel test` runs vitest on
 * `io.cwd` when the project has tests). File effects (scaffold, build) are computed, not applied; the binary applies them.
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
  return (await runEngine(argv, io)).result;
}
