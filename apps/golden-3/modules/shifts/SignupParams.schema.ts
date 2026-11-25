import { type Infer, s } from "@keel/schema";

export const SignupParams = s.object({ signupId: s.id("Signup") });
export type SignupParams = Infer<typeof SignupParams>;
