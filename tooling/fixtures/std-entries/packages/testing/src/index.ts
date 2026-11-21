const SPECIFIER = ["vi", "test"].join("");

export const harness = async (): Promise<unknown> => (await import(SPECIFIER)).vi;
