import { s } from "@keel/schema";

/** Where the sign-in page goes on to once the user is known; the guard sets it. */
export const SigninSearch = s.object({ next: s.string({ max: 200 }).optional() });
