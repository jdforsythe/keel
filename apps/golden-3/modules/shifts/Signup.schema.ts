import { type Infer, s } from "@keel/schema";
import { Email, line, para } from "@keel/std-text";

export const Signup = s.object({
  id: s.id("Signup"),
  shiftId: s.string(),
  name: line({ max: 80 }).pii("name"),
  email: Email.pii("contact"),
  phone: line({ max: 32 }).pii("contact").optional(),
  needs: para({ max: 500 }).pii("special").optional(),
  owner: s.string().pii("identifier"),
  attended: s.boolean(),
});
export type Signup = Infer<typeof Signup>;
