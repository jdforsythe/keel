import { runEngine } from "./internal/runEngine.ts";
import { serveStream } from "./internal/serveStream.ts";
import { usageResult } from "./internal/usageResult.ts";
import type { Io } from "./types/Io.ts";
import type { RunResult } from "./types/RunResult.ts";

/**
 * The engine: run one `keel` command. It reads only `io` (files given, or loaded per operation scope through
 * `io.load`) and hands file effects of a successful command to `io.apply`; `keel test` also runs vitest on
 * `io.cwd` when the project has tests. `mcp` and `lsp` serve their protocol over `io.stdin`: a string is served in
 * one batch and the replies returned as stdout; a stream is served incrementally through `io.emit`. Every
 * surface, the binary included, goes through here.
 */
export async function run(argv: readonly string[], io: Io): Promise<RunResult> {
  const head = argv[0];
  if (head !== "mcp" && head !== "lsp") return (await runEngine(argv, io)).result;
  const extra = argv.slice(1);
  if (extra.length > 0) {
    const shown = (extra[0] ?? "").slice(0, 30);
    const d = { kind: "diag", code: "E1052", message: `${head} takes no arguments: ${shown}`, see: "k.cli" } as const;
    const r = usageResult(head, [d], io, undefined);
    return { code: r.code, stdout: r.stdout, stderr: r.stderr };
  }
  // Loaded only for `mcp` and `lsp`: the language server brings in the checker and typescript.
  const server = head === "mcp" ? (await import("./mcp.ts")).mcp(() => io) : (await import("./lsp.ts")).lsp(() => io);
  const stdin = io.stdin ?? "";
  if (typeof stdin !== "string") {
    const out: string[] = [];
    await serveStream(server, head, stdin, io.emit ?? ((t) => void out.push(t)));
    return { code: 0, stdout: out.join(""), stderr: "" };
  }
  const input = head === "mcp" && stdin !== "" && !stdin.endsWith("\n") ? `${stdin}\n` : stdin;
  return { code: 0, stdout: await server.receive(input), stderr: "" };
}
