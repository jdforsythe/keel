import type { KeelError } from "@keel/schema";
import type { FormHandle } from "./FormHandle.ts";
import type { Href } from "./Href.ts";
import type { MountHref } from "./MountHref.ts";
import type { Verb } from "./Verb.ts";

/**
 * Props of `<Form>`: `action` is the target's `Href` (`routes.href(id, params)`, or a `MountHref`, whose `method` is
 * `'POST'` only). Inside a router whose table matches `action`, `actions[method]` of that route runs on submit;
 * otherwise the browser posts it (k.mount). Pending is `form.pending()`.
 */
export type FormProps<A extends Href = Href> = {
  readonly method: A extends MountHref ? "POST" : Verb;
  readonly action: A;
  readonly form?: FormHandle;
  /** Rendered for a non-field `err` (any `err` when there is no `form`). */
  readonly error?: (e: KeelError<string, unknown>) => Node;
  /** A thunk, so the content is made inside the form; compiled JSX passes one. */
  readonly children?: () => Node | readonly Node[] | string;
};
