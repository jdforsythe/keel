/** 1 for the stale-artifact codes (E1005, W1005), which print after diagnostics on source files; else 0. */
export const artifactRank = (code: string): number => (code === "E1005" || code === "W1005" ? 1 : 0);
