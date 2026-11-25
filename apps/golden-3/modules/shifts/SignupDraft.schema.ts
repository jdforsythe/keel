import { type Infer, s } from "@keel/schema";
import { Email, line, para } from "@keel/std-text";

export const SignupDraft = s.object({
  name: line({ max: 80 }).pii("name"),
  email: Email.pii("contact"),
  phone: line({ max: 32 }).pii("contact").optional(),
  needs: para({ max: 500 }).pii("special").optional(),
});
export type SignupDraft = Infer<typeof SignupDraft>;
