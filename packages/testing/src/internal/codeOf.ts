/** The `code` of a coded failure (`fail`), else undefined. */
export function codeOf(error: unknown): string | undefined {
  return error instanceof Error && "code" in error && typeof error.code === "string" ? error.code : undefined;
}
