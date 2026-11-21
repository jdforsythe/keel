import type { PostedForm } from "./PostedForm.ts";

/**
 * The rejected post the current render shows (k.forms Submit): `@keel/server` sets `current` around a 422 re-render,
 * `resume` around the islands of a document whose `#k-state` holds `form`. A `<Form>` (`@keel/router`) whose `action`
 * and `method` are the post's hands it to its `form` handle before its controls bind, so they render the submitted
 * values and errors.
 */
export const servedForm: { current: PostedForm | null } = { current: null };
