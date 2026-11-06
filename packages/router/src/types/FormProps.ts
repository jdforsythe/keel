import type { KeelError } from "@keel/schema";
import type { FormHandle } from "./FormHandle.ts";
import type { Verb } from "./Verb.ts";

/** Props of `<Form>`: `action` is a route id whose `actions[method]` runs on submit. */
export type FormProps = {
  readonly method: Verb;
  readonly action: string;
  readonly params?: Readonly<Record<string, unknown>>;
  readonly form?: FormHandle;
  /** Rendered while the action is in flight. */
  readonly loading?: () => Node;
  /** Rendered for a non-field `err` (any `err` when there is no `form`). */
  readonly error?: (e: KeelError<string, unknown>) => Node;
  readonly children?: Node | readonly Node[];
};
