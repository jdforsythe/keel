/** What one `identify` call answered: a user, a throw or invalid answer (its `diag` written), or no answer in time. */
export type IdentifyAnswer =
  | { readonly kind: "user"; readonly user: string }
  | { readonly kind: "bad"; readonly bad: string }
  | { readonly kind: "busy"; readonly limit: number };
