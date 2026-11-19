/**
 * The key of the `<Form form>` seam on a form handle: `handle[formHandle]` is a `FormSeam`. Exported
 * only from `@keel/router/internal`, so the seam is not public API; `@keel/forms` implements it.
 */
export const formHandle: unique symbol = Symbol("keel.formHandle");
