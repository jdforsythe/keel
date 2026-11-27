import type { Problem } from "./Problem.ts";

/** A problem a test expects (k.e2e-page `problems`): its `kind`, and a string its text holds or a pattern it matches. */
export type ExpectedProblem = { readonly kind: Problem["kind"]; readonly text: string | RegExp };
