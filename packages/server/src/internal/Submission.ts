/**
 * A rejected no-JS form post (k.forms): the submitted `values` and the `keel.fields` `errors` (path to
 * message), re-rendered with the page at 422 and carried in `#k-state` under `form`.
 */
export type Submission = {
  readonly route: string;
  readonly method: string;
  readonly values: Readonly<Record<string, string | readonly string[]>>;
  readonly errors: Readonly<Record<string, string>>;
};
