/**
 * Everything `runAction` reads or does. `args` are the command-line flags and `tty` whether stdout is a terminal
 * (docs/OUTPUT.md mode). `env` holds `KEEL_SESSIONS_URL`, `KEEL_SESSIONS_TOKEN`, `GITHUB_TOKEN`,
 * `GITHUB_REPOSITORY` and `GITHUB_API_URL`; `now` is epoch milliseconds; `fetch` carries the GitHub REST calls; `run`
 * runs the `keel` binary with `args` under `env` in the project directory; `read` returns a project file's text.
 */
export type ActionIo = {
  readonly args: readonly string[];
  readonly tty: boolean;
  readonly env: Readonly<Record<string, string>>;
  readonly now: () => number;
  readonly fetch: (url: string, init?: RequestInit) => Promise<Response>;
  readonly run: (
    args: readonly string[],
    env: Readonly<Record<string, string>>,
  ) => Promise<{ readonly code: number; readonly stdout: string }>;
  readonly read: (file: string) => string | undefined;
};
