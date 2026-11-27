/** 1 for E1005 (a derived file), which prints after diagnostics on source files; else 0. */
export const artifactRank = (code: string): number => (code === "E1005" ? 1 : 0);
