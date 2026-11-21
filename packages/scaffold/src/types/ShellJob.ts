/**
 * One CI job a shell target asks for (k.shell CI): the generated workflow names it `<deployable>-<job>` and runs it on
 * `runsOn`, its `steps` (shell commands) after the setup and before the install, then `keel build --target <shell>`
 * with `platform` and `env`, then uploads `artifact` (a project-relative path) when given. A `manual` job runs on
 * `workflow_dispatch` only.
 */
export type ShellJob = {
  readonly job: string;
  readonly runsOn: string;
  readonly platform?: string | undefined;
  readonly manual: boolean;
  readonly steps: readonly string[];
  readonly env: Readonly<Record<string, string>>;
  readonly artifact?: string | undefined;
};
