/** A k.schema `Result` by shape (`@keel/reactive` has no dependency on `@keel/schema`): what `resource` unwraps. */
export type Outcome<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: unknown };
