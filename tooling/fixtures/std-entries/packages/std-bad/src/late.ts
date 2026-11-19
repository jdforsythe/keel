export const late = async (): Promise<string> => (await import("../../check/src/index.ts")).defineRule("E0000");
