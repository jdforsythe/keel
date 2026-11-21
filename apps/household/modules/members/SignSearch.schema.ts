import { s } from "@keel/schema";
import { SignError } from "./SignError.schema.ts";

/** The search of the sign-in and sign-up pages: the last refusal, and the page the guard sent the member from. */
export const SignSearch = s.object({ error: SignError.optional(), next: s.string({ max: 200 }).optional() });

export type SignSearch = s.infer<typeof SignSearch>;
