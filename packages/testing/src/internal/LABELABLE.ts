/** Tags named by `<label>` and never by their content (form controls). */
export const LABELABLE: ReadonlySet<string> = new Set(["input", "select", "textarea", "meter", "progress", "output"]);
