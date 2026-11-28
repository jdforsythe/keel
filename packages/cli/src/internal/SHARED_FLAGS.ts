/**
 * The flags every command takes (k.cli, docs/OUTPUT.md), and what `keel mcp` states of them once, in `initialize`'s
 * `instructions`, instead of in each tool's input schema.
 */
export const SHARED_FLAGS: { readonly names: readonly string[]; readonly text: string } = {
  names: ["format", "quiet", "limit", "verbose"],
  text:
    "Every tool also takes the flags every keel command takes, left out of each tool's inputSchema: " +
    'format ("compact", the default, "json" or "pretty"), quiet (boolean: the trailer only), ' +
    "limit (integer: at most this many records per code), verbose (boolean: only with a stated reason).",
};
