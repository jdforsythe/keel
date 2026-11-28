/** The flags `create-app` takes (k.create Flags; `format`, `quiet` and `limit` are k.cli's). */
export type Flags = {
  readonly folder: string;
  readonly adapter: "client" | "node" | "static" | undefined;
  readonly library: string | undefined;
  readonly name: string | undefined;
  readonly existing: boolean;
  readonly dryRun: boolean;
  readonly format: "compact" | "json" | "pretty" | undefined;
  readonly quiet: boolean;
  readonly limit: number | undefined;
};
