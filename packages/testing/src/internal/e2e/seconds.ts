/** A bound for a message: `10.0s`. */
export const seconds = (ms: number): string => `${(ms / 1000).toFixed(1)}s`;
