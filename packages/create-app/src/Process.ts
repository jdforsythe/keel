/** The process as `create-app` reads it (k.create-folder Not done): three environment values, nothing else of it. */
export type Process = {
  readonly argv: readonly string[];
  readonly cwd: string;
  readonly nodeVersion: string;
  readonly tty: boolean;
  /** The signal the process caught, if any: the writes stop at the next file (k.create-folder Folder). */
  readonly stopped?: (() => "SIGINT" | "SIGTERM" | undefined) | undefined;
  readonly env: {
    readonly npm_config_user_agent?: string | undefined;
    readonly KEEL_AGENT?: string | undefined;
    readonly CI?: string | undefined;
  };
};
