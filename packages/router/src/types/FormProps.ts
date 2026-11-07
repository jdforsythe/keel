import type { KeelError } from "@keel/schema";
import type { FormHandle } from "./FormHandle.ts";
import type { Href } from "./Href.ts";
import type { Verb } from "./Verb.ts";

/**
 * Props of `<Form>`: `action` is the target route's `Href` (`routes.href(id, params)`, RFC 0045) whose
 * `actions[method]` runs on submit. Pending is `form.pending()` (RFC 0043).
 */
export type FormProps = {
  readonly method: Verb;
  readonly action: Href;
  readonly form?: FormHandle;
  /** Rendered for a non-field `err` (any `err` when there is no `form`). */
  readonly error?: (e: KeelError<string, unknown>) => Node;
  /** Compiled JSX passes a thunk (RFC 0008); hand-built calls may pass a node, string or array. */
  readonly children?: (() => Node | readonly Node[] | string) | Node | readonly Node[] | string;
};
