import type { ShellApp } from "@keel/scaffold";

/**
 * What a shell target's `build` is given (k.shell Build 5): the app, the project folder `root`, the build folder `dir`
 * (`dist/<name>/<shell>/`, absolute, holding `www/` and the shell files), the `KEEL_ORIGIN` origin, `connect` (the other
 * origins the shell's `net` sends to, k.shell Origins), `--platform`, `--release`, and the environment its tools run with (`KEEL_ORIGIN` and `KEEL_SHELL` set).
 */
export type ShellBuild = ShellApp & {
  readonly root: string;
  readonly dir: string;
  readonly origin: string;
  readonly connect: readonly string[];
  readonly platform: string | undefined;
  readonly release: boolean;
  readonly env: Readonly<Record<string, string | undefined>>;
};
