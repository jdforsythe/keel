export const harness = async (): Promise<unknown> => (await import("vitest")).vi;
