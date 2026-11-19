/** Whether an error's `data` carries a string `at` (where it fired), the one data field a served error keeps. */
export function isAt(data: unknown): data is { readonly at: string } {
  return typeof data === "object" && data !== null && "at" in data && typeof data.at === "string";
}
