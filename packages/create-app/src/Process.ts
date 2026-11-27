/** The process as `create-app` reads it (k.create-folder Not done): three environment values, nothing else of it. */
export type Process = {
  readonly argv: readonly string[];
  readonly cwd: string;
  readonly nodeVersion: string;
  readonly tty: boolean;
  readonly env: {
    readonly npm_config_user_agent?: string | undefined;
    readonly KEEL_AGENT?: string | undefined;
    readonly CI?: string | undefined;
  };
};
