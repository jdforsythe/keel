/**
 * A rejected form post the page re-renders (k.forms Submit): the URL it was posted to (`href`, path and query), its
 * method, the submitted `values` (FormData text by field path) and the `keel.fields` `errors` (path to message).
 */
export type PostedForm = {
  readonly href: string;
  readonly method: string;
  readonly values: Readonly<Record<string, string | readonly string[]>>;
  readonly errors: Readonly<Record<string, string>>;
};
