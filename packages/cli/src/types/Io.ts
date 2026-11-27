import type { Diag } from "../internal/Diag.ts";
import type { FileScope } from "./FileScope.ts";
import type { ShellHost } from "./ShellHost.ts";
import type { SourceFile } from "./SourceFile.ts";
import type { Write } from "./Write.ts";

/**
 * Everything `run` may read or hand back. Tests pass `files` directly; the binary passes `load`, and the engine
 * asks it for the file scope of the operation it runs (`Operation.scope`). `apply` receives the file effects of a
 * successful command (absent: they are dropped). `stdin` as a stream plus `emit` serve `mcp`/`lsp` incrementally;
 * as a string they are served in one batch and the replies returned as stdout. `tty` and `env.KEEL_AGENT` select
 * the default format (OUTPUT.md). `fetch` is the network for `inspect`, `report` and `session ingest` (absent: I1055); `init` carries headers, method, body.
 * `read` returns the text of a file a flag names outside the loaded scope (`check --base`), relative to `cwd`, or undefined.
 * `build` is the disk half of `build` after the engine's writes (`routes.json`, `surface.json`, the Vite builds), so
 * `keel build` and MCP `build` run one path; absent, `build` writes the engine's artifacts only. `refresh` is that
 * half up to the bundles, for a scaffold in a built project (k.scaffold Refresh): `routes.json` and `surface.json`,
 * no Vite build, nothing under `dist/`. `shell` loads what
 * `build --target` needs of the host (k.shell Build; absent: every tool is missing and no shell step runs).
 * `discard` removes folders under `cwd`, whole: a `keel build` failing with E1510 or E1511 leaves no `dist/<name>/` of
 * the deployable serving the entry (k.api Rules).
 */
export type Io = {
  readonly cwd: string;
  readonly files?: readonly SourceFile[] | undefined;
  readonly load?: ((scope: FileScope) => readonly SourceFile[]) | undefined;
  readonly apply?: ((writes: readonly Write[]) => void) | undefined;
  readonly stdin?: string | AsyncIterable<string | Uint8Array> | undefined;
  readonly emit?: ((text: string) => void) | undefined;
  readonly env?: Readonly<Record<string, string>> | undefined;
  readonly tty?: boolean | undefined;
  readonly fetch?: ((url: string, init?: RequestInit) => Promise<Response>) | undefined;
  readonly read?: ((path: string) => string | undefined) | undefined;
  readonly build?:
    | ((cwd: string) => Promise<{ code: number; diagnostics: readonly Diag[]; stderr: string }>)
    | undefined;
  readonly refresh?:
    | ((cwd: string) => Promise<{ code: number; diagnostics: readonly Diag[]; stderr: string }>)
    | undefined;
  readonly shell?: (() => Promise<ShellHost>) | undefined;
  readonly discard?: ((dirs: readonly string[]) => void) | undefined;
};
