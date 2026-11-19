/** The common flags of `keel-session-action` (docs/OUTPUT.md): mode, `--quiet`, `--limit N`. */
export type OutputFlags = {
  readonly mode: "compact" | "json" | "pretty";
  readonly quiet: boolean;
  readonly limit: number | undefined;
};
